import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { Auth } from './Auth';
import { ar } from '../i18n/ar';
import { commands, useStore } from '../services/store';
import { defaults } from '../core/model';
beforeEach(() => {
  useStore.setState({
    data: defaults(),
    userId: null,
    cloudUid: null,
    cloudError: '',
    needsShop: false,
    ready: true,
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it('starts with create or use shop and signs in using existing Firebase credentials', async () => {
  const login = vi.fn(async () => {});
  const setup = vi.fn(async () => {});
  useStore.setState({ login, setup });
  render(<Auth />);
  expect(screen.getByRole('button', { name: ar.createShop })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: ar.useShop }));
  fireEvent.change(screen.getByLabelText(ar.email), {
    target: { value: 'shop@example.com' },
  });
  fireEvent.change(screen.getByLabelText(ar.password), {
    target: { value: 'cloud-password' },
  });
  fireEvent.click(screen.getByRole('button', { name: ar.login }));
  await waitFor(() =>
    expect(login).toHaveBeenCalledWith('shop@example.com', 'cloud-password'),
  );
  expect(setup).not.toHaveBeenCalled();
  expect(screen.queryByLabelText(ar.username)).not.toBeInTheDocument();
});
it('creates a named shop without recreating a separate manager account or recovery code', async () => {
  const setup = vi.fn(async () => {});
  useStore.setState({ setup });
  render(<Auth />);
  fireEvent.click(screen.getByRole('button', { name: ar.createShop }));
  fireEvent.change(screen.getByLabelText(ar.email), {
    target: { value: 'new@example.com' },
  });
  fireEvent.change(screen.getByLabelText(ar.shop), {
    target: { value: 'My shop' },
  });
  fireEvent.change(screen.getByLabelText(ar.password), {
    target: { value: 'cloud-password' },
  });
  fireEvent.click(screen.getByRole('button', { name: ar.createShop }));
  await waitFor(() =>
    expect(setup).toHaveBeenCalledWith(
      'new@example.com',
      'cloud-password',
      'My shop',
      undefined,
    ),
  );
  expect(document.querySelector('.recovery')).toBeNull();
});
it('sends Firebase password recovery by email', async () => {
  const reset = vi.spyOn(commands, 'resetOwnerPassword').mockResolvedValue();
  render(<Auth />);
  fireEvent.click(screen.getByRole('button', { name: ar.useShop }));
  fireEvent.click(screen.getByRole('button', { name: ar.recover }));
  fireEvent.change(screen.getByLabelText(ar.email), {
    target: { value: 'shop@example.com' },
  });
  fireEvent.click(screen.getByRole('button', { name: ar.resetEmail }));
  await waitFor(() => expect(reset).toHaveBeenCalledWith('shop@example.com'));
});
it('shows a recoverable cloud permissions failure instead of silently creating empty local data', () => {
  useStore.setState({ cloudUid: 'owner', cloudError: ar.cloudPermissions });
  render(<Auth />);
  expect(screen.getByRole('alert')).toHaveTextContent(ar.cloudPermissions);
  expect(screen.getByRole('button', { name: ar.cloudRetry })).toBeVisible();
  expect(
    screen.queryByRole('button', { name: ar.createShop }),
  ).not.toBeInTheDocument();
});
