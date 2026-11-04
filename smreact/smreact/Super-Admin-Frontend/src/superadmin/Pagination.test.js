/* Shared pagination: page math, the <Pagination> control, and the Dashboard
   "Current Month Details" table end-to-end on the captured sandbox response
   (127 CurrentMonthDetails rows — the whole list comes in ONE admin_dashboard
   response; the API has no page parameters). */
import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { pageItems, paginate, ELLIPSIS } from './pageMath';
import Pagination from './Pagination';
import Dashboard from './Dashboard';
import ADMIN from './dashboard/__fixtures__/admin_dashboard.sandbox-2026-11-04.json';

const E = ELLIPSIS;

describe('pageItems', () => {
  test.each([
    [1, 14, [1, 2, 3, 4, 5, E, 14]],
    [2, 14, [1, 2, 3, 4, 5, E, 14]],
    [4, 14, [1, 2, 3, 4, 5, 6, E, 14]],
    [7, 14, [1, E, 5, 6, 7, 8, 9, E, 14]],
    [11, 14, [1, E, 9, 10, 11, 12, 13, 14]],
    [14, 14, [1, E, 10, 11, 12, 13, 14]],
    [1, 1, [1]],
    [3, 7, [1, 2, 3, 4, 5, 6, 7]],          // ≤ 7 pages: all shown, never "…"
    [1, 8, [1, 2, 3, 4, 5, E, 8]],
    [500, 1000, [1, E, 498, 499, 500, 501, 502, E, 1000]],
  ])('page %i of %i', (cur, total, expected) => expect(pageItems(cur, total)).toEqual(expected));

  test('never more than 9 slots, current always present, no duplicates, sorted', () => {
    for (let total = 1; total <= 60; total++) {
      for (let cur = 1; cur <= total; cur++) {
        const items = pageItems(cur, total);
        const nums = items.filter((x) => x !== E);
        expect(items.length).toBeLessThanOrEqual(9);
        expect(nums).toContain(cur);
        expect(nums[0]).toBe(1);
        expect(nums[nums.length - 1]).toBe(total);
        expect(new Set(nums).size).toBe(nums.length);
        expect([...nums].sort((a, b) => a - b)).toEqual(nums);
      }
    }
  });

  test('invalid input is clamped', () => {
    expect(pageItems(0, 14)).toEqual(pageItems(1, 14));
    expect(pageItems(99, 14)).toEqual(pageItems(14, 14));
    expect(pageItems(NaN, 0)).toEqual([1]);
  });
});

describe('paginate', () => {
  test('first / last partial page / clamp / empty', () => {
    expect(paginate(127, 1, 10)).toMatchObject({ page: 1, totalPages: 13, start: 0, end: 10, from: 1, to: 10 });
    expect(paginate(127, 13, 10)).toMatchObject({ page: 13, start: 120, end: 127, from: 121, to: 127 });
    expect(paginate(127, 40, 10)).toMatchObject({ page: 13 });
    expect(paginate(127, -3, 10)).toMatchObject({ page: 1 });
    expect(paginate(0, 5, 10)).toMatchObject({ page: 1, totalPages: 1, from: 0, to: 0, start: 0, end: 0 });
    expect(paginate(663759, 2, 100)).toMatchObject({ totalPages: 6638, from: 101, to: 200 });
  });
});

describe('<Pagination>', () => {
  const renderPg = (total, page, size = 10) => {
    const onPageChange = jest.fn();
    render(<Pagination {...paginate(total, page, size)} onPageChange={onPageChange} />);
    return onPageChange;
  };
  const btn = (name) => screen.getByRole('button', { name });

  test('first page: Previous disabled, 1 highlighted, Next goes to 2', () => {
    const go = renderPg(140, 1);
    expect(btn('Previous')).toBeDisabled();
    expect(btn('Page 1')).toHaveAttribute('aria-current', 'page');
    fireEvent.click(btn('Next'));
    expect(go).toHaveBeenCalledWith(2);
    expect(screen.getByTestId('pag-info').textContent).toBe('Showing 1–10 of 140 entries · Page 1 of 14');
  });

  test('last page: Next disabled; ellipsis is not a button; clicking the current page does nothing', () => {
    const go = renderPg(140, 14);
    expect(btn('Next')).toBeDisabled();
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['Previous', '1', '10', '11', '12', '13', '14', 'Next']);
    expect(screen.getByText(E).tagName).toBe('SPAN');
    fireEvent.click(btn('Page 14'));
    expect(go).not.toHaveBeenCalled();
    fireEvent.click(btn('Page 1'));
    expect(go).toHaveBeenCalledWith(1);
  });

  test('one page: both arrows disabled', () => {
    renderPg(7, 1);
    expect(btn('Previous')).toBeDisabled();
    expect(btn('Next')).toBeDisabled();
  });

  test('no records: "Showing 0 entries", no page numbers', () => {
    renderPg(0, 1);
    expect(screen.getByTestId('pag-info').textContent).toBe('Showing 0 entries');
    expect(screen.queryByRole('button', { name: /Page/ })).toBeNull();
    expect(btn('Next')).toBeDisabled();
  });

  test('large dataset: compact, thousands separated', () => {
    renderPg(663759, 3000, 100);
    expect(screen.getAllByRole('button')).toHaveLength(9);   // Prev + 7 numbers + Next
    expect(screen.getByTestId('pag-info').textContent).toBe('Showing 299,901–300,000 of 663,759 entries · Page 3,000 of 6,638');
  });
});

/* ── Dashboard Current Month Details, real captured rows ───────────── */
describe('Dashboard Current Month Details pagination', () => {
  const ok = (body) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
  const API = ADMIN.data.CurrentMonthDetails.map((r) => String(r.SchoolName).trim() || '—');
  let realFetch;
  beforeAll(() => { realFetch = global.fetch; });
  afterAll(() => { global.fetch = realFetch; });
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    global.fetch = (url) => (String(url).includes('admin_dashboard') ? ok(ADMIN) : Promise.resolve({ ok: false, status: 503, json: () => Promise.resolve({}) }));
  });
  afterEach(() => jest.restoreAllMocks());

  const table = () => screen.getByTestId('fee-table');
  const names = () => [...screen.getByTestId('fee-table').querySelectorAll('tbody tr')].map((tr) => tr.cells[0].textContent.trim());
  const info = () => within(table()).getByTestId('pag-info').textContent;
  const click = (name) => fireEvent.click(within(table()).getByRole('button', { name }));
  const setSize = (n) => fireEvent.change(within(table()).getByDisplayValue(/^(10|25|50|100)$/), { target: { value: String(n) } });

  async function open() {
    render(<Dashboard toast={() => {}} />);
    await waitFor(() => expect(screen.getByTestId('fee-table')).toBeTruthy(), { timeout: 4000 });
  }

  test('every page shows exactly the API rows for that slice; total = API row count', async () => {
    await open();
    expect(API).toHaveLength(127);
    expect(info()).toBe('Showing 1–10 of 127 entries · Page 1 of 13');
    expect(names()).toEqual(API.slice(0, 10));
    const seen = [...names()];
    for (let p = 2; p <= 13; p++) {
      click('Next');
      expect(names()).toEqual(API.slice((p - 1) * 10, p * 10));
      seen.push(...names());
    }
    expect(seen).toEqual(API);                                    // nothing skipped, nothing twice
    expect(info()).toBe('Showing 121–127 of 127 entries · Page 13 of 13');
    expect(within(table()).getByRole('button', { name: 'Next' })).toBeDisabled();
  });

  test('page number jump (middle) and Previous', async () => {
    await open();
    click('Page 5');
    click('Page 7');
    expect(names()).toEqual(API.slice(60, 70));
    expect(within(table()).getAllByRole('button').map((b) => b.textContent).filter((t) => /^\d+$/.test(t))).toEqual(['1', '5', '6', '7', '8', '9', '13']);
    click('Previous');
    expect(names()).toEqual(API.slice(50, 60));
  });

  test('rows per page change resets to page 1 and re-slices', async () => {
    await open();
    click('Page 5');
    setSize(25);
    expect(info()).toBe('Showing 1–25 of 127 entries · Page 1 of 6');
    expect(names()).toEqual(API.slice(0, 25));
    setSize(100);
    click('Page 2');
    expect(names()).toEqual(API.slice(100));
  });

  test('search resets to page 1; paging after filtering stays inside the filtered rows; no match → 0', async () => {
    await open();
    click('Page 4');
    fireEvent.change(screen.getByPlaceholderText('Search school...'), { target: { value: 'school' } });
    const match = API.filter((n) => n.toLowerCase().includes('school'));
    expect(info()).toBe(`Showing 1–10 of ${match.length} entries · Page 1 of ${Math.ceil(match.length / 10)}`);
    click('Page 3');
    expect(names()).toEqual(match.slice(20, 30));
    fireEvent.change(screen.getByPlaceholderText('Search school...'), { target: { value: 'zzzz-no-such-school' } });
    expect(info()).toBe('Showing 0 entries');
  });
});
