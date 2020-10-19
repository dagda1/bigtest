import { describe, beforeEach, it } from 'mocha';
import * as expect from 'expect';

import * as zlib from 'zlib';

import { Operation } from 'effection';
import { Atom } from '@bigtest/atom';
import { AgentServerConfig } from '@bigtest/agent';
import { fetch } from '@effection/fetch';

import { actions } from './helpers';
import { createProxyServer } from '../src/proxy';
import { OrchestratorState } from '../src/orchestrator/state';
import { createOrchestratorAtom } from '../src/orchestrator/atom';
import { express } from '@bigtest/effection-express';

const PROXY_PORT = 24202;
const APP_PORT = 24203;

let agentServerConfig = new AgentServerConfig({ port: APP_PORT, prefix: '/__bigtest/', });

function* startAppServer(): Operation<void> {
  let appServer = express();

  yield appServer.get('/simple', function*(req, res) {
    res.set({ 'Content-Type': 'text/html' });
    res.send('<!doctype html><html><head></head><body><h1>Hello world</h1></body></html>');
  });

  yield appServer.get('/zipped', function*(req, res) {
    res.set({ 'Content-Type': 'text/html', 'Content-Encoding': 'gzip' });
    res.send(zlib.gzipSync('<!doctype html><html><head></head><body><h1>Hello zip world</h1></body></html>'));
  });

  yield appServer.get('/asset', function*(req, res) {
    res.set({ 'Content-Type': 'text/plain' });
    res.send('<!doctype html><html><head></head><body><h1>Hello world</h1></body></html>');
  });

  yield appServer.listen(APP_PORT);

  yield
}

describe('proxy', () => {
  let atom: Atom<OrchestratorState>;

  describe('with working app server', () => {
    beforeEach(async () => {
      actions.fork(startAppServer);

      atom = createOrchestratorAtom({
        app: {
          url: `http://localhost:${APP_PORT}`
        }
      });
      actions.fork(createProxyServer({ atom, agentServerConfig, port: PROXY_PORT }));

      await actions.fork(atom.once((s) => s.proxyService.proxyStatus === 'started'));
    });

    describe('retrieving html file', () => {
      let response: Response;
      let body: string;

      beforeEach(async () => {
        response = await actions.fork(fetch(`http://localhost:${PROXY_PORT}/simple`));
        body = await actions.fork(response.text());
      });

      it('injects the harness script', () => {
        expect(response.status).toEqual(200);
        expect(body).toContain('<h1>Hello world</h1>');
        expect(body).toContain('<script src="http://localhost:24203/__bigtest/harness.js"></script>');
      });
    });

    describe('retrieving gzipped html file', () => {
      let response: Response;
      let body: string;

      beforeEach(async () => {
        response = await actions.fork(fetch(`http://localhost:${PROXY_PORT}/zipped`));
        body = await actions.fork(response.text());
      });

      it('decodez zip and injects the harness script', () => {
        expect(response.status).toEqual(200);
        expect(body).toContain('<h1>Hello zip world</h1>');
        expect(body).toContain('<script src="http://localhost:24203/__bigtest/harness.js"></script>');
      });
    });

    describe('other asset', () => {
      let response: Response;
      let body: string;

      beforeEach(async () => {
        response = await actions.fork(fetch(`http://localhost:${PROXY_PORT}/asset`));
        body = await actions.fork(response.text());
      });

      it('returns it unmodified', () => {
        expect(response.status).toEqual(200);
        expect(body).toContain('<h1>Hello world</h1>');
        expect(body).not.toContain('script');
      });
    });
  });

  describe('proxy error', () => {
    let response: Response;
    let body: string;

    beforeEach(async () => {
      atom = createOrchestratorAtom();
      actions.fork(createProxyServer({ atom, agentServerConfig, port: PROXY_PORT }));

      await actions.fork(atom.once((s) => s.proxyService.proxyStatus === 'started'));

      response = await actions.fork(fetch(`http://localhost:${PROXY_PORT}/simple`));
      body = await actions.fork(response.text());
    });

    it('logs a gatetway error', () => {
      expect(response.status).toEqual(502);
      expect(body).toContain('Proxy error');
    });
  });
});