function Field({ label, value }) {
  if (!value) return null
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{label}</span>
      <span style={{ fontWeight: 500, textAlign: 'right', maxWidth: '60%' }}>{value}</span>
    </div>
  )
}

export default function VerifiedCard({ drug }) {
  return (
    <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', overflow: 'hidden' }}>
      <div style={{ background: 'var(--green)', color: '#fff', padding: '16px 20px' }}>
        <div style={{ fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.05em', opacity: 0.9 }}>✓ VERIFIED</div>
        <div style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: 4 }}>{drug.drug_name}</div>
      </div>
      <div style={{ padding: '0 20px' }}>
        <Field label="Active Ingredient" value={drug.generic_name} />
        <Field label="Strength" value={drug.strength} />
        <Field label="Route of Admin." value={drug.roa} />
        <Field label="Manufacturer" value={drug.manufacturer} />
        <Field label="Reg. Number" value={drug.reg_number} />
        <Field label="Dosage Form" value={drug.dosage_form} />
        <Field label="Category" value={drug.therapeutic_category} />
        <Field label="Approved" value={drug.approval_date} />
      </div>
    </div>
  )
}
