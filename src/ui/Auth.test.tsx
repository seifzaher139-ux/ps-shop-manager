import { afterEach, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { Auth } from './Auth';
import { ar } from '../i18n/ar';
import { useStore } from '../services/store';
import { defaults } from '../core/model';
afterEach(() => cleanup());
it('keeps recovery code visible until acknowledged before logging in', async () => {
  const setup = vi.fn(async () => 'ABCD-1234-5678-ABCD');
  const login = vi.fn(async () => {});
  useStore.setState({ data: defaults(), userId: null, setup, login });
  render(<Auth />);
  fireEvent.change(screen.getByLabelText(ar.username), {
    target: { value: 'Seif' },
  });
  fireEvent.change(screen.getByLabelText(ar.password), {
    target: { value: '12345678' },
  });
  fireEvent.click(screen.getByRole('button', { name: ar.setup }));
  await screen.findByText('ABCD-1234-5678-ABCD');
  expect(login).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: ar.continue }));
  await waitFor(() => expect(login).toHaveBeenCalledWith('Seif', '12345678'));
});
