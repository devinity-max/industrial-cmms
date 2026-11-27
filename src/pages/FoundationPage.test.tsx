import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { FoundationPage } from './FoundationPage';

it('renders local setup status without a configured backend', () => {
  const markup = renderToStaticMarkup(<FoundationPage />);
  expect(markup).toContain('Foundation shell ready');
  expect(markup).toContain('<dt>Data connection</dt><dd>Disconnected</dd>');
});
