interface Props {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}

/** An on/off switch: a real button with role="switch", so Space, Enter and screen readers work. */
export function Switch({ label, checked, onChange, disabled }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className="switch"
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span className="switch-knob" aria-hidden="true" />
    </button>
  )
}
