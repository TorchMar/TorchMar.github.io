export function createTaskPool(limit = 2) {
  let running = 0;
  const waiting = [];
  const drain = () => {
    while (running < limit && waiting.length) {
      const { work, resolve, reject } = waiting.shift();
      running++;
      Promise.resolve().then(work).then(resolve, reject).finally(() => { running--; drain(); });
    }
  };
  return work => new Promise((resolve, reject) => { waiting.push({ work, resolve, reject }); drain(); });
}
