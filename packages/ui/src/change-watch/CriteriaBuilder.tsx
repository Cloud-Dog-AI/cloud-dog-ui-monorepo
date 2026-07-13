// @cloud-dog/ui — CriteriaBuilder (W28E-1870-F, PS-102 §10).
// Builds watch criteria (glob / regex / field patterns + action verbs) using
// platform form controls. Controlled component: parent owns the value.

import type { CriterionKind, WatchCriteria, WatchCriterion } from "./types";

export type CriteriaBuilderProps = Readonly<{
  value: WatchCriteria;
  onChange: (next: WatchCriteria) => void;
  /** Field/metadata keys the service exposes (for kind "field"). */
  fields?: readonly string[];
  /** Action verbs the service can emit (PS-102 §4 ACTIONS). */
  actionOptions?: readonly string[];
  className?: string;
}>;

const KINDS: readonly CriterionKind[] = ["glob", "regex", "field"];

export function CriteriaBuilder({
  value,
  onChange,
  fields,
  actionOptions,
  className,
}: CriteriaBuilderProps) {
  const patch = (id: string, next: Partial<WatchCriterion>) =>
    onChange({ ...value, match: value.match.map((c) => (c.id === id ? { ...c, ...next } : c)) });

  const add = () =>
    onChange({
      ...value,
      match: [...value.match, { id: `c${value.match.length + 1}`, kind: "glob", pattern: "" }],
    });

  const remove = (id: string) =>
    onChange({ ...value, match: value.match.filter((c) => c.id !== id) });

  const toggleAction = (action: string, on: boolean) =>
    onChange({
      ...value,
      actions: on ? [...value.actions, action] : value.actions.filter((a) => a !== action),
    });

  return (
    <div className={className} aria-label="Criteria builder">
      <ul>
        {value.match.map((c) => (
          <li key={c.id}>
            <label>
              Kind
              <select
                aria-label={`Criterion ${c.id} kind`}
                value={c.kind}
                onChange={(e) => patch(c.id, { kind: e.currentTarget.value as CriterionKind })}
              >
                {KINDS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </label>
            {c.kind === "field" ? (
              <label>
                Field
                {fields && fields.length > 0 ? (
                  <select
                    aria-label={`Criterion ${c.id} field`}
                    value={c.field ?? ""}
                    onChange={(e) => patch(c.id, { field: e.currentTarget.value })}
                  >
                    <option value="">(any)</option>
                    {fields.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    aria-label={`Criterion ${c.id} field`}
                    value={c.field ?? ""}
                    onChange={(e) => patch(c.id, { field: e.currentTarget.value })}
                  />
                )}
              </label>
            ) : null}
            <label>
              Pattern
              <input
                aria-label={`Criterion ${c.id} pattern`}
                value={c.pattern}
                onChange={(e) => patch(c.id, { pattern: e.currentTarget.value })}
              />
            </label>
            <button type="button" onClick={() => remove(c.id)} aria-label={`Remove criterion ${c.id}`}>
              Remove
            </button>
          </li>
        ))}
      </ul>
      <button type="button" onClick={add}>
        Add criterion
      </button>
      {actionOptions && actionOptions.length > 0 ? (
        <fieldset aria-label="Action filter">
          <legend>Actions</legend>
          {actionOptions.map((a) => (
            <label key={a}>
              <input
                type="checkbox"
                aria-label={`Action ${a}`}
                checked={value.actions.includes(a)}
                onChange={(e) => toggleAction(a, e.currentTarget.checked)}
              />
              {a}
            </label>
          ))}
        </fieldset>
      ) : null}
    </div>
  );
}
