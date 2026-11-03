import '@testing-library/jest-dom/vitest';
import { server } from './server.js';

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
