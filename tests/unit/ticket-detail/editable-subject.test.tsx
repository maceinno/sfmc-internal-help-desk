// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { EditableSubject } from '@/components/ticket-detail/editable-subject'

const ORIGINAL = 'Laptop will not connect to VPN'

function setup(props: Partial<React.ComponentProps<typeof EditableSubject>> = {}) {
  const onSave = vi.fn()
  const utils = render(
    <EditableSubject
      value={ORIGINAL}
      canEdit
      onSave={onSave}
      {...props}
    />,
  )
  return { onSave, ...utils }
}

function openEditor() {
  fireEvent.click(screen.getByLabelText('Edit subject'))
  return screen.getByLabelText('Ticket subject') as HTMLInputElement
}

describe('editable subject — who sees the control', () => {
  it('shows the subject as plain text when the user cannot edit', () => {
    setup({ canEdit: false })
    expect(screen.getByText(ORIGINAL)).toBeInTheDocument()
    expect(screen.queryByLabelText('Edit subject')).toBeNull()
  })

  it('offers an edit control when the user can edit', () => {
    setup()
    expect(screen.getByLabelText('Edit subject')).toBeInTheDocument()
  })
})

describe('editable subject — saving', () => {
  beforeEach(() => vi.clearAllMocks())

  it('saves a changed subject on Enter', () => {
    const { onSave } = setup()
    const input = openEditor()
    fireEvent.change(input, { target: { value: 'VPN drops on Denver wifi' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSave).toHaveBeenCalledWith('VPN drops on Denver wifi')
  })

  it('saves when the tick is clicked', () => {
    const { onSave } = setup()
    const input = openEditor()
    fireEvent.change(input, { target: { value: 'Reworded' } })
    fireEvent.click(screen.getByLabelText('Save subject'))
    expect(onSave).toHaveBeenCalledWith('Reworded')
  })

  it('trims surrounding whitespace before saving', () => {
    const { onSave } = setup()
    const input = openEditor()
    fireEvent.change(input, { target: { value: '   Padded subject   ' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSave).toHaveBeenCalledWith('Padded subject')
  })

  it('does not save when nothing actually changed', () => {
    const { onSave } = setup()
    const input = openEditor()
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSave).not.toHaveBeenCalled()
    // and it closes the editor
    expect(screen.getByText(ORIGINAL)).toBeInTheDocument()
  })

  it('does not save whitespace-only edits that reduce to the same subject', () => {
    const { onSave } = setup()
    const input = openEditor()
    fireEvent.change(input, { target: { value: `  ${ORIGINAL}  ` } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSave).not.toHaveBeenCalled()
  })
})

describe('editable subject — refusing bad input', () => {
  beforeEach(() => vi.clearAllMocks())

  it('refuses an empty subject and says why, without discarding the edit', () => {
    const { onSave } = setup()
    const input = openEditor()
    fireEvent.change(input, { target: { value: '   ' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onSave).not.toHaveBeenCalled()
    expect(screen.getByText('A subject is required.')).toBeInTheDocument()
    // Still editing — the user's cursor is not thrown away.
    expect(screen.getByLabelText('Ticket subject')).toBeInTheDocument()
  })

  it('clears the error as soon as the user types again', () => {
    setup()
    const input = openEditor()
    fireEvent.change(input, { target: { value: '' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(screen.getByText('A subject is required.')).toBeInTheDocument()

    fireEvent.change(input, { target: { value: 'Better subject' } })
    expect(screen.queryByText('A subject is required.')).toBeNull()
  })
})

describe('editable subject — cancelling', () => {
  beforeEach(() => vi.clearAllMocks())

  it('restores the original subject on Escape', () => {
    const { onSave } = setup()
    const input = openEditor()
    fireEvent.change(input, { target: { value: 'Half-typed thing' } })
    fireEvent.keyDown(input, { key: 'Escape' })

    expect(onSave).not.toHaveBeenCalled()
    expect(screen.getByText(ORIGINAL)).toBeInTheDocument()
  })

  it('restores the original subject when the cross is clicked', () => {
    const { onSave } = setup()
    const input = openEditor()
    fireEvent.change(input, { target: { value: 'Half-typed thing' } })
    fireEvent.click(screen.getByLabelText('Cancel editing subject'))

    expect(onSave).not.toHaveBeenCalled()
    expect(screen.getByText(ORIGINAL)).toBeInTheDocument()
  })
})

describe('editable subject — while saving', () => {
  it('locks the field so a slow save cannot be double-submitted', () => {
    setup({ isSaving: true })
    const input = openEditor()
    expect(input).toBeDisabled()
    expect(screen.getByLabelText('Save subject')).toBeDisabled()
  })
})

describe('editable subject — staying in step with the ticket', () => {
  it('picks up a subject changed elsewhere while not editing', () => {
    const { rerender } = setup()
    rerender(
      <EditableSubject value="Renamed by someone else" canEdit onSave={vi.fn()} />,
    )
    expect(screen.getByText('Renamed by someone else')).toBeInTheDocument()
  })
})
