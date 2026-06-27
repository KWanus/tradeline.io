# The Method — "There's Always a Way"

> How to get unblocked when someone (or something) says you can't. This file
> exists to keep this way of thinking in play on every task. It is referenced
> from `CLAUDE.md` so it loads into context automatically. When you hit a wall,
> run this loop before you accept the wall.

The core belief: **a blocker is almost never the end — it's a prompt to find
the footprint.** The thing you want leaves traces in data you *can* get. Your
job is to find the trace, not to get the gated original.

---

## The loop

1. **Don't accept the blocker at face value.** When you hear "you need a
   partner / a paid API / a relationship / permission," treat that as a claim to
   test, not a fact to obey. Ask: *what is the footprint of the thing I want in
   data I can already reach?*

2. **Separate what you actually need from what you assumed you need.** We thought
   we needed the marketplace's sale record. We didn't. We needed two things:
   *did the supply move?* and *what's the price?* — both of which have public
   footprints the marketplace doesn't own.

3. **Test the cheapest workaround first, and let evidence kill or confirm it
   before you build.** Don't build on a hunch. Probe the data in a throwaway
   script, look at real values, then decide. A fast "no" is worth more than a
   slow maybe.

4. **When the direct path is closed, reframe to a proxy or an adjacent
   disclosure.** The other side of a transaction often discloses what your side
   hides. A balance sheet shows the result of an action even when the action is
   private. An aggregate shows the trend even when the record is sealed.

5. **Build the smallest honest thing that's verifiable.** Ship the proxy, label
   it a proxy, show its confidence. Never dress a proxy as a confirmation or
   invent precision the data doesn't support. Integrity is part of the method —
   a fake number is worse than an honest gap.

6. **Verify against live data before you claim it works.** Run it. Show the
   actual figure. "It should work" is not done; "PRA is paying 13.2¢, here's the
   filing" is done.

7. **Leave a seam for the better source later.** "Can't fully automate today"
   ≠ "never." Build the adapter/config/CSV seam so the day you get the gated
   feed, it drops in without a rewrite.

---

## Where the footprints hide (check these first)

- **Public regulatory filings.** SEC (EDGAR, XBRL, full-text search), FDIC &
  NCUA Call Reports, PACER/CourtListener. Regulators force disclosure that
  private parties would never volunteer.
- **The *other side* of the transaction.** Sellers hid the deal? The buyer is
  public and books what they paid. (Encore/PRA disclose cents-on-the-dollar; the
  selling bank never would.)
- **Balance-sheet movements as event proxies.** You can't see the sale, but you
  can see the loan book that held the paper drop to zero next quarter.
- **Aggregated / redistributed data.** The gated API has a free mirror. BLS
  state unemployment is keyless via FRED's CSV. The "premium" cut is often
  public one layer over.
- **Dimensional data the convenience API flattens.** `companyfacts` gives only
  consolidated totals — but the raw XBRL *instance* carries the by-segment
  members. The breakdown was there; the easy endpoint just dropped it.

---

## Case studies from this codebase (proof the loop works)

| Wall | Footprint found | Built |
|---|---|---|
| "Marketplaces gate confirmed sales" | Banks' noncurrent-loan book drops the quarter the paper leaves | `disposition_proxy.py` (labeled a proxy) |
| "No way to know what paper sells for without a feed" | Public buyers XBRL-tag price ÷ face = cents on the dollar | `buyers.py` — live ~12.5¢ |
| "Did our flags predict anything?" | Disposition events + leading flags both in public filings; join them | `backtest.py` |
| "BLS needs an API key" | FRED redistributes BLS LAUS keyless | `macro.py` |
| "companyfacts has no asset-class split" | The raw 10-Q **instance** tags `PortfolioSegmentAxis` (PRA: Core vs Insolvency) | dimensional instance parse |

Every one started as "you can't." Each was tested, reframed, and shipped from
public data. **Default to that. There's almost always a way — find the
footprint, build the honest version, verify it live.**
