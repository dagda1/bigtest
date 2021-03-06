import { Operation } from 'effection';
import { Mailbox } from '@bigtest/effection';
import { once, throwOnErrorEvent } from '@effection/events';

import * as Bundler from 'parcel-bundler';
import { ParcelOptions } from  'parcel-bundler';
import { createServer, RequestListener } from 'http';
import { EventEmitter } from 'events';

interface ParcelServerOptions {
  port?: number;
};

export function* createParcelServer(entryPoints: string[], options: ParcelServerOptions & ParcelOptions): Operation {
  let bundler = new Bundler(entryPoints, options) as unknown as ParcelBundler;

  let events = yield Mailbox.subscribe(bundler, "buildEnd");

  let middleware = bundler.middleware();
  let server = createServer(middleware)

  try {
    yield throwOnErrorEvent(server);

    if(options.port) {
      server.listen(options.port);
      yield once(server, "listening");
    }

    yield events.receive({ event: "buildEnd" });

    if (process.send) {
      process.send({ type: "ready", options: bundler.options });
    }

    while(true) {
      yield events.receive({ event: "buildEnd" });

      if (process.send) {
        process.send({ type: "update" });
      }
    }
  } finally {
    bundler.stop();
    server.close();
  }
}

interface ParcelBundler extends EventEmitter {
  middleware(): RequestListener;
  stop(): void;
  options: ParcelOptions;
}
