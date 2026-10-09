import { inactiveSchoolCount, publishableSchools } from './data'

/* ═══════════════════════════════════════════════════════════════════
   Scope notice. Every exam and result policy applies to all schools in
   the chain. Inactive schools are excluded and are never a target.
   ═══════════════════════════════════════════════════════════════════ */
export default function AllSchoolsScope() {
  const count = publishableSchools().length
  const inactive = inactiveSchoolCount()
  return (
    <div className="exm-scope">
      <div className="exm-scope-summary">
        <span>Applies to:</span>
        <strong>All schools in the chain ({count})</strong>
      </div>
      <div className="exm-note">
        <i className="fa-solid fa-circle-info" />
        <span>
          Schools added to the chain later receive it on the next publish.
          {inactive > 0 && ` ${inactive} inactive school${inactive === 1 ? ' is' : 's are'} excluded.`}
        </span>
      </div>
    </div>
  )
}
