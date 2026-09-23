export function BudgetBar({ spent, total }: { spent: number; total: number }) {
  return (
    <section className="budget-box" aria-label="Budget overview">
      <div className="spread">
        <span className="eyebrow">YOUR CITY BUDGET</span>
        <span className="unit-tag">VIRTUAL UNITS</span>
      </div>
      <div className="budget-number">
        <strong>{total - spent}</strong>
        <span> / {total} remaining</span>
      </div>
      <progress
        className="budget-progress"
        max={total}
        value={spent}
        aria-label={`${spent} of ${total} budget units allocated`}
      />
      <div className="spread small">
        <span>{spent} allocated</span>
        <span>{total - spent} available</span>
      </div>
    </section>
  );
}
