const channel = 'silvae:ming-library';

/** Local host adapter: model data is a projection of the authenticated catalog. */
export function connectSilvae(api, {captureView, restoreView}) {
  const send = (type, fields = {}) => {
    if (window.parent !== window) window.parent.postMessage({channel, type, ...fields}, location.origin);
  };
  let previous = [], pending = null, applying = false, initialized = false, restored = false;
  const apply = async () => {
    if (applying || !initialized) return;
    applying = true;
    try {
      while (pending) {
        const {books, view} = pending; pending = null;
        const sameIds = previous.length === books.length && previous.every((book, i) => book.id === books[i].id);
        if (sameIds) {
          for (let i = 0; i < books.length; i++) {
            if (JSON.stringify(previous[i]) !== JSON.stringify(books[i])) await api.updateBook(books[i].id, books[i]);
          }
        } else await api.setBooks(books);
        previous = books;
        if (!restored) {restored = true; if (view) await restoreView(view);}
        send('catalog-applied', {count: books.length, state: api.getState()});
      }
    } catch (error) {send('error', {message: error.message});}
    finally {applying = false;}
  };
  window.addEventListener('message', event => {
    if (event.source !== window.parent || event.origin !== location.origin || event.data?.channel !== channel) return;
    if (event.data.type === 'host-ready' && initialized) send('ready');
    if (event.data.type === 'catalog' && Array.isArray(event.data.books)) {
      pending = {books: event.data.books, view: event.data.view};
      void apply();
    }
  });
  document.getElementById('back-button').addEventListener('click', () => send('back'));
  document.getElementById('selection-read').addEventListener('click', event => {
    event.preventDefault();
    const bookId = api.getState().selectedBookId;
    if (bookId && previous.some(book => book.id === bookId)) send('read-book', {bookId, view: captureView()});
  });
  api.ready.then(() => {initialized = true; send('ready'); void apply();})
    .catch(error => send('error', {message: error.message}));
  window.addEventListener('pagehide', () => {pending = null; previous = [];});
}
