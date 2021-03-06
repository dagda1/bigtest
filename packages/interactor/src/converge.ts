import { performance } from '@bigtest/performance';

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function converge<T>(timeout: number, fn: () => T): Promise<T> {
  let startTime = performance.now();
  while(true) {
    try {
      return fn();
    } catch(e) {
      let diff = performance.now() - startTime;
      if(diff > timeout) {
        throw e;
      } else {
        await wait(1);
      }
    }
  }
}
