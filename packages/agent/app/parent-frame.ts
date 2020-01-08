import { Operation } from 'effection';
import { Mailbox, suspend, subscribe } from '@bigtest/effection';

export class ParentFrame {
  static *start() {
    let mailbox = new Mailbox();
    yield suspend(subscribe(mailbox, window, ['message']));
    return new ParentFrame(mailbox);
  }

  constructor(private mailbox: Mailbox) {}

  send(message) {
    window.parent.postMessage(JSON.stringify(message), "*");
  }

  *receive(): Operation {
    let { args: [message] } = yield this.mailbox.receive({ event: 'message' });
    return message.data;
  }
}