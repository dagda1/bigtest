import { fork, resource, Operation } from 'effection';
import { createServer, Server } from 'http';
import { promisify } from 'util';
import { monitorErrors } from '@bigtest/effection';

import {
  server as WebSocketServer,
  request as Request,
} from 'websocket';

import { Mailbox, once, ensure } from '@bigtest/effection';

interface AgentConnectionServerOptions {
  port: number;
  inbox: Mailbox;
  delegate: Mailbox;
}

export class AgentConnectionServer {
  constructor(public options: AgentConnectionServerOptions) {}

  *listen(): Operation<Server> {
    let { port, inbox, delegate } = this.options;

    let httpServer = createServer();
    let socketServer = new WebSocketServer({ httpServer });

    httpServer.listen(port);
    yield once(httpServer, "listening");

    return yield resource(httpServer, function*() {
      yield ensure(() => {
        httpServer.close()
        socketServer.unmount();
      });
      yield monitorErrors(httpServer);
      yield acceptConnections(socketServer, inbox, delegate);
    });
  }
}

let ids = 1;

function* acceptConnections(server: WebSocketServer, inbox: Mailbox, delegate: Mailbox): Operation {
  while (true) {
    let [request]: [Request] = yield once(server, "request");
    let connection = request.accept(null, request.origin);
    let sendData = promisify<string, void>(connection.send.bind(connection));
    let agentId = `agent.${ids++}`;

    let handler = yield fork(function* setupConnection() {
      let halt = () => handler.halt();
      let fail = (error: Error) => {
        if(error["code"] === 'ECONNRESET') {
          handler.halt();
        } else {
          handler.fail(error);
        }
      }

      let messages = yield Mailbox.subscribe(connection, "message");

      yield fork(function*() {
        while (true) {
          let message = yield inbox.receive({ agentId });
          yield sendData(JSON.stringify(message));
        }
      });

      yield fork(function*() {
        while (true) {
          let { args } = yield messages.receive();
          let message = JSON.parse(args[0].utf8Data);
          message.agentId = agentId;
          delegate.send(message);
        }
      });

      try {
        connection.on("error", fail);
        connection.on("close", halt);
        delegate.send({ status: 'connected', agentId });

        yield;
      } finally {
        delegate.send({ status: 'disconnected', agentId });
        connection.off("error", fail);
        connection.off("close", halt);
      }
    });
  }
}
