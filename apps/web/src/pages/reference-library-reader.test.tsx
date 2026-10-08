import { fireEvent, render, screen } from '@testing-library/react';
import { Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { TestProviders } from '../test/TestProviders';
import { ReaderPage } from './ReaderPage';

const returnState = {returnTo: '/virtual-library', libraryView: {x: 7, y: 8, z: 3, yaw: 0.4, pitch: 0.08}};
function OpenFromLibrary() {
  const navigate = useNavigate();
  return <button onClick={() => navigate('/reader/book-1', {state: returnState})}>Open real catalog book</button>;
}
function ReturnedLibrary() {
  const location = useLocation();
  return <output aria-label="Restored library camera">{JSON.stringify(location.state)}</output>;
}

it('returns a 3D-library reading session to its previous camera without changing the book identity', async () => {
  sessionStorage.setItem('bookkin-demo-session', JSON.stringify({
    id: 'user-owner', username: 'owner', displayName: '林', role: 'OWNER', mustChangePassword: false,
  }));
  render(<TestProviders><Routes>
    <Route path="/" element={<OpenFromLibrary />} />
    <Route path="/reader/:bookId" element={<ReaderPage />} />
    <Route path="/virtual-library" element={<ReturnedLibrary />} />
  </Routes></TestProviders>);
  fireEvent.click(screen.getByRole('button', {name: 'Open real catalog book'}));
  await screen.findByRole('heading', {name: '灯下'});
  fireEvent.click(screen.getByRole('button', {name: '返回虚拟书库'}));
  expect(JSON.parse(screen.getByLabelText('Restored library camera').textContent ?? '{}')).toEqual(returnState);
});
