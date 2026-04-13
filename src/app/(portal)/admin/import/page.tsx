'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import {
  Upload,
  Download,
  FileText,
  Check,
  AlertTriangle,
  AlertCircle,
  Users,
  Loader2,
  Ticket,
  CheckCircle2,
  XCircle,
  RefreshCw,
} from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import type {
  TicketStatus,
  TicketPriority,
  TicketCategory,
} from '@/types/ticket'

// ============================================================================
// Types
// ============================================================================

type RowStatus = 'valid' | 'warning' | 'error'
type ImportStep = 'upload' | 'preview' | 'importing' | 'complete'

// ── Users ───────────────────────────────────────────────────────────────────

interface ParsedUserRow {
  rowNumber: number
  name: string
  email: string
  role: string
  department: string
  team: string
  branch: string
  region: string
  status: RowStatus
  messages: string[]
}

interface UserImportResult {
  created: number
  updated: number
  errors: string[]
  total: number
}

// ── Tickets ─────────────────────────────────────────────────────────────────

interface ParsedTicketRow {
  rowNumber: number
  title: string
  description: string
  status: TicketStatus
  priority: TicketPriority
  category: string
  createdByEmail: string
  assignedToEmail?: string
  createdAt: string
  updatedAt: string
  oldSystemId?: string
  validationStatus: RowStatus
  messages: string[]
}

interface TicketImportResult {
  created: number
  errors: string[]
  total: number
}

type DetectedFormat = 'csv' | 'json' | 'zendesk' | null

// ============================================================================
// Constants
// ============================================================================

const VALID_ROLES = ['employee', 'agent', 'admin']
const VALID_STATUSES: TicketStatus[] = [
  'new',
  'open',
  'pending',
  'on_hold',
  'solved',
]
const VALID_PRIORITIES: TicketPriority[] = ['urgent', 'high', 'medium', 'low']

const USER_CSV_TEMPLATE = `Name,Email,Role,Department,Team,Branch,Region
Jane Smith,jane.smith@sfmc.com,employee,Loan Support,Lending Support,Downtown Branch,Aldridge
Bob Johnson,bob.johnson@sfmc.com,agent,System Support,IT Support,Midtown Office,GW
Alice Brown,alice.brown@sfmc.com,admin,Administration,Closing Support,Corporate HQ,Corporate`

const TICKET_CSV_TEMPLATE = `Title,Description,Status,Priority,Category,CreatedByEmail,AssignedToEmail,CreatedAt
Loan processing delay,The loan has not been processed within SLA,open,high,Loan Origination,user@sfmc.com,agent@sfmc.com,2024-01-15T10:30:00Z
System access issue,Cannot log into the underwriting portal,new,medium,IT Systems,user2@sfmc.com,,2024-01-16T08:00:00Z`

const TICKET_JSON_TEMPLATE = {
  tickets: [
    {
      title: 'Example ticket',
      description: 'Detailed description of the issue',
      status: 'open',
      priority: 'medium',
      category: 'Loan Origination',
      createdByEmail: 'user@sfmc.com',
      assignedToEmail: 'agent@sfmc.com',
      createdAt: '2024-01-15T10:30:00Z',
    },
  ],
}

// ============================================================================
// Helpers
// ============================================================================

function parseCSV(text: string): string[][] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim())
  return lines.map((line) => {
    const result: string[] = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      if (char === '"') {
        inQuotes = !inQuotes
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
    result.push(current.trim())
    return result
  })
}

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

// Zendesk status mapping to our system
function mapZendeskStatus(zendeskStatus: string): TicketStatus {
  const statusMap: Record<string, TicketStatus> = {
    new: 'new',
    open: 'open',
    pending: 'pending',
    hold: 'on_hold',
    solved: 'solved',
    closed: 'solved',
  }
  return statusMap[zendeskStatus.toLowerCase()] || 'open'
}

function mapZendeskPriority(zendeskPriority: string): TicketPriority {
  const priorityMap: Record<string, TicketPriority> = {
    low: 'low',
    normal: 'medium',
    high: 'high',
    urgent: 'urgent',
  }
  return priorityMap[zendeskPriority.toLowerCase()] || 'medium'
}

function isZendeskFormat(data: Record<string, unknown>): boolean {
  if (!data.tickets || !Array.isArray(data.tickets)) return false
  const firstTicket = data.tickets[0]
  if (!firstTicket) return false
  return 'requester_id' in firstTicket || 'assignee_id' in firstTicket
}

function transformZendeskTickets(
  data: Record<string, unknown>,
): Record<string, unknown>[] {
  const tickets = (data.tickets as Record<string, unknown>[]) || []
  const users = (data.users as Record<string, unknown>[]) || []

  const userMap = new Map<number, Record<string, unknown>>()
  users.forEach((user) => {
    if (user.id) userMap.set(user.id as number, user)
  })

  return tickets.map((ticket) => {
    const requester = userMap.get(ticket.requester_id as number)
    const assignee = userMap.get(ticket.assignee_id as number)

    const requesterEmail =
      (requester?.email as string) ||
      (ticket.requester_id
        ? `user-${ticket.requester_id}@imported.zendesk`
        : '')
    const assigneeEmail =
      (assignee?.email as string) ||
      (ticket.assignee_id
        ? `agent-${ticket.assignee_id}@imported.zendesk`
        : undefined)

    return {
      title: ticket.subject || ticket.raw_subject || '',
      description: ticket.description || '',
      status: mapZendeskStatus((ticket.status as string) || 'open'),
      priority: mapZendeskPriority((ticket.priority as string) || 'normal'),
      category: (ticket.type as string) || 'General',
      createdByEmail: requesterEmail,
      assignedToEmail: assigneeEmail,
      createdAt: ticket.created_at || new Date().toISOString(),
      updatedAt:
        ticket.updated_at || ticket.created_at || new Date().toISOString(),
      oldSystemId: ticket.id ? `zendesk-${ticket.id}` : undefined,
    }
  })
}

function downloadBlob(content: string, fileName: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}

// ============================================================================
// Users Import Tab
// ============================================================================

function UsersImportTab() {
  const [step, setStep] = useState<ImportStep>('upload')
  const [parsedRows, setParsedRows] = useState<ParsedUserRow[]>([])
  const [fileName, setFileName] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [importResult, setImportResult] = useState<UserImportResult | null>(
    null,
  )
  const [allowUpdates, setAllowUpdates] = useState(true)
  const [filterStatus, setFilterStatus] = useState<RowStatus | 'all'>('all')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const validateRows = useCallback((rawRows: string[][]): ParsedUserRow[] => {
    if (rawRows.length < 2) return []

    const headers = rawRows[0].map((h) => h.toLowerCase().trim())
    const nameIdx = headers.findIndex(
      (h) => h.includes('name') && !h.includes('team'),
    )
    const emailIdx = headers.findIndex((h) => h.includes('email'))
    const roleIdx = headers.findIndex((h) => h.includes('role'))
    const deptIdx = headers.findIndex(
      (h) => h.includes('department') || h.includes('dept'),
    )
    const teamIdx = headers.findIndex((h) => h.includes('team'))
    const branchIdx = headers.findIndex((h) => h.includes('branch'))
    const regionIdx = headers.findIndex((h) => h.includes('region'))

    const seenEmails = new Set<string>()
    const dataRows = rawRows.slice(1)

    return dataRows.map((cols, idx) => {
      const row: ParsedUserRow = {
        rowNumber: idx + 2,
        name: cols[nameIdx] || '',
        email: cols[emailIdx] || '',
        role: (cols[roleIdx] || '').toLowerCase(),
        department: cols[deptIdx] || '',
        team: cols[teamIdx] || '',
        branch: cols[branchIdx] || '',
        region: cols[regionIdx] || '',
        status: 'valid',
        messages: [],
      }

      // Required field checks
      if (!row.name.trim()) {
        row.status = 'error'
        row.messages.push('Name is required')
      }
      if (!row.email.trim()) {
        row.status = 'error'
        row.messages.push('Email is required')
      } else if (!validateEmail(row.email)) {
        row.status = 'error'
        row.messages.push('Invalid email format')
      }

      // Duplicate within file
      if (row.email && seenEmails.has(row.email.toLowerCase())) {
        row.status = 'error'
        row.messages.push('Duplicate email in file')
      }
      if (row.email) seenEmails.add(row.email.toLowerCase())

      // Role validation
      if (row.role && !VALID_ROLES.includes(row.role)) {
        row.status = 'error'
        row.messages.push(
          `Invalid role "${row.role}" -- must be employee, agent, or admin`,
        )
      }

      // Admin role warning
      if (row.role === 'admin') {
        if (row.status !== 'error') row.status = 'warning'
        row.messages.push('Admin role -- verify this is intentional')
      }

      return row
    })
  }, [])

  const handleFile = useCallback(
    (file: File) => {
      if (!file.name.endsWith('.csv') && !file.type.includes('csv')) {
        alert('Please upload a CSV file')
        return
      }
      setFileName(file.name)
      const reader = new FileReader()
      reader.onload = (e) => {
        const text = e.target?.result as string
        const rawRows = parseCSV(text)
        const validated = validateRows(rawRows)
        setParsedRows(validated)
        setStep('preview')
      }
      reader.readAsText(file)
    },
    [validateRows],
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      const file = e.dataTransfer.files[0]
      if (file) handleFile(file)
    },
    [handleFile],
  )

  const executeImport = async () => {
    setStep('importing')

    const importableRows = parsedRows.filter((r) => {
      if (r.status === 'error') return false
      return true
    })

    const usersPayload = importableRows.map((row) => ({
      name: row.name,
      email: row.email,
      role: row.role || 'employee',
      department: row.department || undefined,
      team: row.team || undefined,
      branch: row.branch || undefined,
      region: row.region || undefined,
    }))

    try {
      const res = await fetch('/api/import/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ users: usersPayload }),
      })

      const result = await res.json()

      setImportResult({
        created: result.created ?? 0,
        updated: result.updated ?? 0,
        errors: result.errors ?? [],
        total: result.total ?? usersPayload.length,
      })
      setStep('complete')
    } catch (err) {
      setImportResult({
        created: 0,
        updated: 0,
        errors: [
          `Network error: ${err instanceof Error ? err.message : 'Unknown error'}`,
        ],
        total: usersPayload.length,
      })
      setStep('complete')
    }
  }

  const validCount = parsedRows.filter((r) => r.status === 'valid').length
  const warningCount = parsedRows.filter((r) => r.status === 'warning').length
  const errorCount = parsedRows.filter((r) => r.status === 'error').length
  const importableCount = validCount + (allowUpdates ? warningCount : 0)

  const filteredRows =
    filterStatus === 'all'
      ? parsedRows
      : parsedRows.filter((r) => r.status === filterStatus)

  const downloadTemplate = () => {
    downloadBlob(USER_CSV_TEMPLATE, 'user_import_template.csv', 'text/csv')
  }

  const downloadErrorReport = () => {
    const errorRows = parsedRows.filter((r) => r.status === 'error')
    const csv = [
      'Row,Name,Email,Role,Errors',
      ...errorRows.map(
        (r) =>
          `${r.rowNumber},"${r.name}","${r.email}","${r.role}","${r.messages.join('; ')}"`,
      ),
    ].join('\n')
    downloadBlob(csv, 'import_errors.csv', 'text/csv')
  }

  const resetImport = () => {
    setStep('upload')
    setParsedRows([])
    setFileName('')
    setImportResult(null)
  }

  // ── Upload step ───────────────────────────────────────────────────────────
  if (step === 'upload') {
    return (
      <div className="space-y-5">
        {/* Template Download */}
        <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-blue-900">
                Download CSV Template
              </p>
              <p className="text-xs text-blue-600 mt-0.5">
                Pre-formatted with columns: Name, Email, Role, Department, Team,
                Branch, Region
              </p>
            </div>
          </div>
          <button
            onClick={downloadTemplate}
            className="flex items-center px-3 py-2 text-sm font-medium text-blue-700 bg-blue-100 rounded-lg hover:bg-blue-200 transition-colors"
          >
            <Download className="w-4 h-4 mr-1.5" />
            Template
          </button>
        </div>

        {/* Drop Zone */}
        <div
          onDrop={handleDrop}
          onDragOver={(e) => {
            e.preventDefault()
            setIsDragging(true)
          }}
          onDragLeave={() => setIsDragging(false)}
          onClick={() => fileInputRef.current?.click()}
          className={`relative flex flex-col items-center justify-center p-10 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
            isDragging
              ? 'border-blue-400 bg-blue-50'
              : 'border-gray-300 bg-gray-50/50 hover:border-gray-400 hover:bg-gray-50'
          }`}
        >
          <div
            className={`p-3 rounded-full mb-3 ${isDragging ? 'bg-blue-100' : 'bg-gray-100'}`}
          >
            <Upload
              className={`w-6 h-6 ${isDragging ? 'text-blue-600' : 'text-gray-400'}`}
            />
          </div>
          <p className="text-sm font-medium text-gray-700">
            {isDragging
              ? 'Drop your CSV file here'
              : 'Drag & drop a CSV file here'}
          </p>
          <p className="text-xs text-gray-500 mt-1">or click to browse files</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleFile(file)
            }}
            className="hidden"
          />
        </div>

        {/* Import Options */}
        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Import Options
          </p>
          <label className="flex items-center justify-between cursor-pointer">
            <div className="flex items-center gap-2.5">
              <RefreshCw className="w-4 h-4 text-gray-400" />
              <div>
                <span className="text-sm font-medium text-gray-700">
                  Update existing users
                </span>
                <p className="text-xs text-gray-500">
                  Match by email and update their details
                </p>
              </div>
            </div>
            <div
              onClick={() => setAllowUpdates(!allowUpdates)}
              className={`relative w-9 h-5 rounded-full transition-colors ${allowUpdates ? 'bg-blue-600' : 'bg-gray-300'}`}
            >
              <div
                className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${allowUpdates ? 'translate-x-4' : 'translate-x-0.5'}`}
              />
            </div>
          </label>
        </div>
      </div>
    )
  }

  // ── Preview step ──────────────────────────────────────────────────────────
  if (step === 'preview') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            {parsedRows.length} rows found in{' '}
            <span className="font-medium text-gray-700">{fileName}</span>
          </p>
          <button
            onClick={resetImport}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Upload different file
          </button>
        </div>

        {/* Filter badges */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setFilterStatus('all')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filterStatus === 'all' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            <Users className="w-3.5 h-3.5" />
            All ({parsedRows.length})
          </button>
          <button
            onClick={() => setFilterStatus('valid')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filterStatus === 'valid' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}
          >
            <Check className="w-3.5 h-3.5" />
            Valid ({validCount})
          </button>
          <button
            onClick={() => setFilterStatus('warning')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filterStatus === 'warning' ? 'bg-amber-500 text-white' : 'bg-amber-50 text-amber-700 hover:bg-amber-100'}`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            Warnings ({warningCount})
          </button>
          <button
            onClick={() => setFilterStatus('error')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filterStatus === 'error' ? 'bg-red-600 text-white' : 'bg-red-50 text-red-700 hover:bg-red-100'}`}
          >
            <AlertCircle className="w-3.5 h-3.5" />
            Errors ({errorCount})
          </button>
        </div>

        {/* Preview table */}
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-200 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 w-10">#</th>
                  <th className="px-4 py-3 w-16">Status</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3">Team</th>
                  <th className="px-4 py-3 min-w-[200px]">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredRows.map((row) => (
                  <tr
                    key={row.rowNumber}
                    className={
                      row.status === 'error'
                        ? 'bg-red-50/50'
                        : row.status === 'warning'
                          ? 'bg-amber-50/30'
                          : ''
                    }
                  >
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {row.rowNumber}
                    </td>
                    <td className="px-4 py-3">
                      {row.status === 'valid' && (
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100">
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        </span>
                      )}
                      {row.status === 'warning' && (
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-100">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                        </span>
                      )}
                      {row.status === 'error' && (
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-100">
                          <AlertCircle className="w-3.5 h-3.5 text-red-600" />
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {row.name || (
                        <span className="text-red-400 italic">Missing</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {row.email || (
                        <span className="text-red-400 italic">Missing</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          row.role === 'admin'
                            ? 'bg-purple-100 text-purple-700'
                            : row.role === 'agent'
                              ? 'bg-blue-100 text-blue-700'
                              : row.role === 'employee'
                                ? 'bg-gray-100 text-gray-700'
                                : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {row.role || 'invalid'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      {row.department || '\u2014'}
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      {row.team || '\u2014'}
                    </td>
                    <td className="px-4 py-3">
                      {row.messages.length > 0 && (
                        <div className="space-y-0.5">
                          {row.messages.map((msg, i) => (
                            <p
                              key={i}
                              className={`text-xs ${row.status === 'error' ? 'text-red-600' : 'text-amber-600'}`}
                            >
                              {msg}
                            </p>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-3">
            {errorCount > 0 && (
              <button
                onClick={downloadErrorReport}
                className="flex items-center px-3 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
              >
                <Download className="w-4 h-4 mr-1.5" />
                Download Error Report
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <p className="text-sm text-gray-500">
              <span className="font-medium text-gray-900">
                {importableCount}
              </span>{' '}
              users will be imported
            </p>
            <button
              onClick={resetImport}
              className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={executeImport}
              disabled={importableCount === 0}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              Import {importableCount} Users
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Importing step ────────────────────────────────────────────────────────
  if (step === 'importing') {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        </div>
        <p className="text-sm font-medium text-gray-700 mt-4">
          Processing {importableCount} users...
        </p>
        <p className="text-xs text-gray-500 mt-1">This may take a moment</p>
      </div>
    )
  }

  // ── Complete step ─────────────────────────────────────────────────────────
  if (step === 'complete' && importResult) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4 p-5 bg-emerald-50 rounded-xl border border-emerald-200">
          <div className="p-2.5 bg-emerald-100 rounded-full">
            <CheckCircle2 className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <p className="text-base font-semibold text-emerald-900">
              Import completed
            </p>
            <p className="text-sm text-emerald-700 mt-0.5">
              {importResult.created + importResult.updated} of{' '}
              {importResult.total} users processed successfully
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 bg-white rounded-xl border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 bg-emerald-100 rounded-lg">
                <Users className="w-4 h-4 text-emerald-600" />
              </div>
              <span className="text-xs font-medium text-gray-500 uppercase">
                Created
              </span>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {importResult.created}
            </p>
          </div>
          <div className="p-4 bg-white rounded-xl border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 bg-blue-100 rounded-lg">
                <RefreshCw className="w-4 h-4 text-blue-600" />
              </div>
              <span className="text-xs font-medium text-gray-500 uppercase">
                Updated
              </span>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {importResult.updated}
            </p>
          </div>
          <div className="p-4 bg-white rounded-xl border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 bg-red-100 rounded-lg">
                <XCircle className="w-4 h-4 text-red-500" />
              </div>
              <span className="text-xs font-medium text-gray-500 uppercase">
                Errors
              </span>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {importResult.errors.length}
            </p>
          </div>
        </div>

        {importResult.errors.length > 0 && (
          <div className="p-4 bg-red-50 rounded-xl border border-red-200">
            <p className="text-sm font-medium text-red-900 mb-2">Errors</p>
            <ul className="space-y-1">
              {importResult.errors.slice(0, 10).map((err, i) => (
                <li key={i} className="text-xs text-red-700">
                  {err}
                </li>
              ))}
              {importResult.errors.length > 10 && (
                <li className="text-xs text-red-600 font-medium">
                  +{importResult.errors.length - 10} more errors
                </li>
              )}
            </ul>
          </div>
        )}

        <div className="flex justify-end">
          <button
            onClick={resetImport}
            className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors shadow-sm"
          >
            Import More
          </button>
        </div>
      </div>
    )
  }

  return null
}

// ============================================================================
// Tickets Import Tab
// ============================================================================

function TicketsImportTab() {
  const [step, setStep] = useState<ImportStep>('upload')
  const [parsedTickets, setParsedTickets] = useState<ParsedTicketRow[]>([])
  const [fileName, setFileName] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [importResult, setImportResult] =
    useState<TicketImportResult | null>(null)
  const [filterStatus, setFilterStatus] = useState<RowStatus | 'all'>('all')
  const [detectedFormat, setDetectedFormat] = useState<DetectedFormat>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const validateTickets = useCallback(
    (tickets: Record<string, unknown>[]): ParsedTicketRow[] => {
      return tickets.map((ticket, idx) => {
        const parsed: ParsedTicketRow = {
          rowNumber: idx + 1,
          title: (ticket.title as string) || '',
          description: (ticket.description as string) || '',
          status: (
            ((ticket.status as string) || 'new').toLowerCase() as TicketStatus
          ),
          priority: (
            ((ticket.priority as string) || 'medium').toLowerCase() as TicketPriority
          ),
          category: (ticket.category as string) || 'General',
          createdByEmail: (ticket.createdByEmail as string) || '',
          assignedToEmail: (ticket.assignedToEmail as string) || undefined,
          createdAt:
            (ticket.createdAt as string) || new Date().toISOString(),
          updatedAt:
            (ticket.updatedAt as string) ||
            (ticket.createdAt as string) ||
            new Date().toISOString(),
          oldSystemId: (ticket.oldSystemId as string) || undefined,
          validationStatus: 'valid',
          messages: [],
        }

        // Required field checks
        if (!parsed.title.trim()) {
          parsed.validationStatus = 'error'
          parsed.messages.push('Title is required')
        }
        if (!parsed.description.trim()) {
          parsed.validationStatus = 'error'
          parsed.messages.push('Description is required')
        }
        if (!parsed.createdByEmail.trim()) {
          parsed.validationStatus = 'error'
          parsed.messages.push('Creator email is required')
        } else if (!validateEmail(parsed.createdByEmail)) {
          if (parsed.validationStatus !== 'error')
            parsed.validationStatus = 'warning'
          parsed.messages.push(
            `Creator email "${parsed.createdByEmail}" may not match a system user`,
          )
        }

        // Validate assignee email if provided
        if (parsed.assignedToEmail && !validateEmail(parsed.assignedToEmail)) {
          if (parsed.validationStatus !== 'error')
            parsed.validationStatus = 'warning'
          parsed.messages.push(
            `Assignee "${parsed.assignedToEmail}" may not match a system user`,
          )
        }

        // Status validation
        if (!VALID_STATUSES.includes(parsed.status)) {
          parsed.validationStatus = 'error'
          parsed.messages.push(
            `Invalid status "${parsed.status}" -- must be: ${VALID_STATUSES.join(', ')}`,
          )
        }

        // Priority validation
        if (!VALID_PRIORITIES.includes(parsed.priority)) {
          parsed.validationStatus = 'error'
          parsed.messages.push(
            `Invalid priority "${parsed.priority}" -- must be: ${VALID_PRIORITIES.join(', ')}`,
          )
        }

        // Date validation
        if (parsed.createdAt && isNaN(Date.parse(parsed.createdAt))) {
          if (parsed.validationStatus !== 'error')
            parsed.validationStatus = 'warning'
          parsed.messages.push(
            'Invalid createdAt date format -- will use current date',
          )
          parsed.createdAt = new Date().toISOString()
        }

        return parsed
      })
    },
    [],
  )

  const handleFile = useCallback(
    (file: File) => {
      const isCSV =
        file.name.endsWith('.csv') || file.type.includes('csv')
      const isJSON =
        file.name.endsWith('.json') || file.type.includes('json')

      if (!isCSV && !isJSON) {
        alert('Please upload a CSV or JSON file')
        return
      }

      setFileName(file.name)
      const reader = new FileReader()

      reader.onload = (e) => {
        const text = e.target?.result as string

        try {
          let tickets: Record<string, unknown>[]
          let format: DetectedFormat = null

          if (isCSV) {
            // Parse CSV
            format = 'csv'
            const rawRows = parseCSV(text)
            if (rawRows.length < 2) {
              alert('CSV file is empty or has no data rows')
              return
            }
            const headers = rawRows[0].map((h) => h.toLowerCase().trim())
            const titleIdx = headers.findIndex(
              (h) => h.includes('title') || h.includes('subject'),
            )
            const descIdx = headers.findIndex(
              (h) => h.includes('description') || h.includes('desc'),
            )
            const statusIdx = headers.findIndex((h) => h === 'status')
            const priorityIdx = headers.findIndex((h) => h === 'priority')
            const categoryIdx = headers.findIndex(
              (h) => h.includes('category') || h.includes('type'),
            )
            const createdByIdx = headers.findIndex(
              (h) =>
                h.includes('createdby') ||
                h.includes('created_by') ||
                h.includes('creator') ||
                h.includes('requester'),
            )
            const assignedToIdx = headers.findIndex(
              (h) =>
                h.includes('assignedto') ||
                h.includes('assigned_to') ||
                h.includes('assignee'),
            )
            const createdAtIdx = headers.findIndex(
              (h) =>
                h.includes('createdat') ||
                h.includes('created_at') ||
                h.includes('date'),
            )

            tickets = rawRows.slice(1).map((cols) => ({
              title: cols[titleIdx] || '',
              description: cols[descIdx] || '',
              status: cols[statusIdx] || 'new',
              priority: cols[priorityIdx] || 'medium',
              category: cols[categoryIdx] || 'General',
              createdByEmail: cols[createdByIdx] || '',
              assignedToEmail: cols[assignedToIdx] || undefined,
              createdAt: cols[createdAtIdx] || undefined,
            }))
          } else {
            // Parse JSON
            let data: Record<string, unknown>
            try {
              data = JSON.parse(text)
            } catch {
              // Try JSONL
              const lines = text.split('\n').filter((l) => l.trim())
              const parsedLines = lines.map(
                (l) => JSON.parse(l) as Record<string, unknown>,
              )
              if (parsedLines.length > 0 && parsedLines[0].subject) {
                data = { tickets: parsedLines }
                format = 'zendesk'
              } else {
                throw new Error('Invalid JSON format')
              }
            }

            if (format !== 'zendesk' && isZendeskFormat(data)) {
              format = 'zendesk'
            }

            if (format === 'zendesk') {
              tickets = transformZendeskTickets(data)
            } else {
              format = 'json'
              tickets = Array.isArray(data)
                ? (data as Record<string, unknown>[])
                : ((data.tickets as Record<string, unknown>[]) || [])
            }
          }

          if (!tickets || tickets.length === 0) {
            alert('No valid tickets found in file')
            return
          }

          setDetectedFormat(format)
          const validated = validateTickets(tickets)
          setParsedTickets(validated)
          setStep('preview')
        } catch (err) {
          alert(
            `Error parsing file: ${err instanceof Error ? err.message : 'Unknown error'}`,
          )
        }
      }

      reader.readAsText(file)
    },
    [validateTickets],
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      const file = e.dataTransfer.files[0]
      if (file) handleFile(file)
    },
    [handleFile],
  )

  const executeImport = async () => {
    setStep('importing')

    const validTickets = parsedTickets.filter(
      (t) => t.validationStatus !== 'error',
    )

    const ticketsPayload = validTickets.map((t) => ({
      title: t.title,
      description: t.description,
      status: t.status,
      priority: t.priority,
      category: t.category,
      createdByEmail: t.createdByEmail,
      assignedToEmail: t.assignedToEmail,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    }))

    try {
      const res = await fetch('/api/import/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tickets: ticketsPayload }),
      })

      const result = await res.json()

      setImportResult({
        created: result.created ?? 0,
        errors: result.errors ?? [],
        total: result.total ?? ticketsPayload.length,
      })
      setStep('complete')
    } catch (err) {
      setImportResult({
        created: 0,
        errors: [
          `Network error: ${err instanceof Error ? err.message : 'Unknown error'}`,
        ],
        total: ticketsPayload.length,
      })
      setStep('complete')
    }
  }

  const validCount = parsedTickets.filter(
    (t) => t.validationStatus === 'valid',
  ).length
  const warningCount = parsedTickets.filter(
    (t) => t.validationStatus === 'warning',
  ).length
  const errorCount = parsedTickets.filter(
    (t) => t.validationStatus === 'error',
  ).length
  const importableCount = validCount + warningCount

  const filteredTickets =
    filterStatus === 'all'
      ? parsedTickets
      : parsedTickets.filter((t) => t.validationStatus === filterStatus)

  const resetImport = () => {
    setStep('upload')
    setParsedTickets([])
    setFileName('')
    setImportResult(null)
    setDetectedFormat(null)
  }

  // ── Upload step ───────────────────────────────────────────────────────────
  if (step === 'upload') {
    return (
      <div className="space-y-5">
        {/* Template Downloads */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <FileText className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-blue-900">CSV Template</p>
                <p className="text-xs text-blue-600 mt-0.5">Standard CSV format</p>
              </div>
            </div>
            <button
              onClick={() =>
                downloadBlob(
                  TICKET_CSV_TEMPLATE,
                  'ticket_import_template.csv',
                  'text/csv',
                )
              }
              className="flex items-center px-3 py-2 text-sm font-medium text-blue-700 bg-blue-100 rounded-lg hover:bg-blue-200 transition-colors"
            >
              <Download className="w-4 h-4 mr-1.5" />
              CSV
            </button>
          </div>
          <div className="flex items-center justify-between p-4 bg-purple-50 rounded-lg border border-purple-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <FileText className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-purple-900">
                  JSON Template
                </p>
                <p className="text-xs text-purple-600 mt-0.5">
                  Also supports Zendesk JSON
                </p>
              </div>
            </div>
            <button
              onClick={() =>
                downloadBlob(
                  JSON.stringify(TICKET_JSON_TEMPLATE, null, 2),
                  'ticket_import_template.json',
                  'application/json',
                )
              }
              className="flex items-center px-3 py-2 text-sm font-medium text-purple-700 bg-purple-100 rounded-lg hover:bg-purple-200 transition-colors"
            >
              <Download className="w-4 h-4 mr-1.5" />
              JSON
            </button>
          </div>
        </div>

        {/* Drop Zone */}
        <div
          onDrop={handleDrop}
          onDragOver={(e) => {
            e.preventDefault()
            setIsDragging(true)
          }}
          onDragLeave={() => setIsDragging(false)}
          onClick={() => fileInputRef.current?.click()}
          className={`relative flex flex-col items-center justify-center p-10 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
            isDragging
              ? 'border-blue-400 bg-blue-50'
              : 'border-gray-300 bg-gray-50/50 hover:border-gray-400 hover:bg-gray-50'
          }`}
        >
          <div
            className={`p-3 rounded-full mb-3 ${isDragging ? 'bg-blue-100' : 'bg-gray-100'}`}
          >
            <Upload
              className={`w-6 h-6 ${isDragging ? 'text-blue-600' : 'text-gray-400'}`}
            />
          </div>
          <p className="text-sm font-medium text-gray-700">
            {isDragging
              ? 'Drop your file here'
              : 'Drag & drop a CSV or JSON file here'}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Supports CSV, JSON, and Zendesk JSON exports
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.json,text/csv,application/json"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleFile(file)
            }}
            className="hidden"
          />
        </div>

        {/* Zendesk mapping info */}
        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Zendesk Status Mapping
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
            {[
              ['new', 'new'],
              ['open', 'open'],
              ['pending', 'pending'],
              ['hold', 'on_hold'],
              ['solved', 'solved'],
              ['closed', 'solved'],
            ].map(([from, to]) => (
              <div key={from} className="flex items-center gap-2 text-gray-600">
                <span className="font-medium">{from}</span>
                <span className="text-gray-400">&rarr;</span>
                <span className="font-medium text-gray-900">{to}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ── Preview step ──────────────────────────────────────────────────────────
  if (step === 'preview') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">
              {parsedTickets.length} tickets found in{' '}
              <span className="font-medium text-gray-700">{fileName}</span>
            </p>
            {detectedFormat && (
              <p className="text-xs text-gray-400 mt-0.5">
                Detected format:{' '}
                <span className="font-medium">
                  {detectedFormat === 'zendesk'
                    ? 'Zendesk JSON'
                    : detectedFormat.toUpperCase()}
                </span>
              </p>
            )}
          </div>
          <button
            onClick={resetImport}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Upload different file
          </button>
        </div>

        {/* Filter badges */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setFilterStatus('all')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filterStatus === 'all' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            <Ticket className="w-3.5 h-3.5" />
            All ({parsedTickets.length})
          </button>
          <button
            onClick={() => setFilterStatus('valid')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filterStatus === 'valid' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}
          >
            <Check className="w-3.5 h-3.5" />
            Valid ({validCount})
          </button>
          <button
            onClick={() => setFilterStatus('warning')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filterStatus === 'warning' ? 'bg-amber-500 text-white' : 'bg-amber-50 text-amber-700 hover:bg-amber-100'}`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            Warnings ({warningCount})
          </button>
          <button
            onClick={() => setFilterStatus('error')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filterStatus === 'error' ? 'bg-red-600 text-white' : 'bg-red-50 text-red-700 hover:bg-red-100'}`}
          >
            <AlertCircle className="w-3.5 h-3.5" />
            Errors ({errorCount})
          </button>
        </div>

        {/* Preview table */}
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-200 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 w-10">#</th>
                  <th className="px-4 py-3 w-16">Valid</th>
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3">Creator</th>
                  <th className="px-4 py-3">Assignee</th>
                  <th className="px-4 py-3 min-w-[200px]">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredTickets.map((row) => (
                  <tr
                    key={row.rowNumber}
                    className={
                      row.validationStatus === 'error'
                        ? 'bg-red-50/50'
                        : row.validationStatus === 'warning'
                          ? 'bg-amber-50/30'
                          : ''
                    }
                  >
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {row.rowNumber}
                    </td>
                    <td className="px-4 py-3">
                      {row.validationStatus === 'valid' && (
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100">
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        </span>
                      )}
                      {row.validationStatus === 'warning' && (
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-100">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                        </span>
                      )}
                      {row.validationStatus === 'error' && (
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-100">
                          <AlertCircle className="w-3.5 h-3.5 text-red-600" />
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900 max-w-[200px] truncate">
                      {row.title || (
                        <span className="text-red-400 italic">Missing</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                        {row.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          row.priority === 'urgent'
                            ? 'bg-red-100 text-red-700'
                            : row.priority === 'high'
                              ? 'bg-orange-100 text-orange-700'
                              : row.priority === 'medium'
                                ? 'bg-yellow-100 text-yellow-700'
                                : 'bg-green-100 text-green-700'
                        }`}
                      >
                        {row.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      {row.createdByEmail || '\u2014'}
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      {row.assignedToEmail || '\u2014'}
                    </td>
                    <td className="px-4 py-3">
                      {row.messages.length > 0 && (
                        <div className="space-y-0.5">
                          {row.messages.map((msg, i) => (
                            <p
                              key={i}
                              className={`text-xs ${row.validationStatus === 'error' ? 'text-red-600' : 'text-amber-600'}`}
                            >
                              {msg}
                            </p>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-2">
          <div />
          <div className="flex items-center gap-3">
            <p className="text-sm text-gray-500">
              <span className="font-medium text-gray-900">
                {importableCount}
              </span>{' '}
              tickets will be imported
            </p>
            <button
              onClick={resetImport}
              className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={executeImport}
              disabled={importableCount === 0}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              Import {importableCount} Tickets
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Importing step ────────────────────────────────────────────────────────
  if (step === 'importing') {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        </div>
        <p className="text-sm font-medium text-gray-700 mt-4">
          Importing {importableCount} tickets...
        </p>
        <p className="text-xs text-gray-500 mt-1">This may take a moment</p>
      </div>
    )
  }

  // ── Complete step ─────────────────────────────────────────────────────────
  if (step === 'complete' && importResult) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4 p-5 bg-emerald-50 rounded-xl border border-emerald-200">
          <div className="p-2.5 bg-emerald-100 rounded-full">
            <CheckCircle2 className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <p className="text-base font-semibold text-emerald-900">
              Import completed
            </p>
            <p className="text-sm text-emerald-700 mt-0.5">
              {importResult.created} of {importResult.total} tickets imported
              successfully
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-white rounded-xl border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 bg-emerald-100 rounded-lg">
                <Ticket className="w-4 h-4 text-emerald-600" />
              </div>
              <span className="text-xs font-medium text-gray-500 uppercase">
                Created
              </span>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {importResult.created}
            </p>
          </div>
          <div className="p-4 bg-white rounded-xl border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 bg-red-100 rounded-lg">
                <XCircle className="w-4 h-4 text-red-500" />
              </div>
              <span className="text-xs font-medium text-gray-500 uppercase">
                Errors
              </span>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {importResult.errors.length}
            </p>
          </div>
        </div>

        {importResult.errors.length > 0 && (
          <div className="p-4 bg-red-50 rounded-xl border border-red-200">
            <p className="text-sm font-medium text-red-900 mb-2">Errors</p>
            <ul className="space-y-1">
              {importResult.errors.slice(0, 10).map((err, i) => (
                <li key={i} className="text-xs text-red-700">
                  {err}
                </li>
              ))}
              {importResult.errors.length > 10 && (
                <li className="text-xs text-red-600 font-medium">
                  +{importResult.errors.length - 10} more errors
                </li>
              )}
            </ul>
          </div>
        )}

        <div className="flex justify-end">
          <button
            onClick={resetImport}
            className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors shadow-sm"
          >
            Import More
          </button>
        </div>
      </div>
    )
  }

  return null
}

// ============================================================================
// Main Page
// ============================================================================

export default function AdminImportPage() {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Bulk Import</h1>
        <p className="text-gray-500 mt-1">
          Import users and tickets from CSV or JSON files
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <Tabs defaultValue={0}>
          <TabsList>
            <TabsTrigger value={0}>
              <Users className="w-4 h-4" />
              Users
            </TabsTrigger>
            <TabsTrigger value={1}>
              <Ticket className="w-4 h-4" />
              Tickets
            </TabsTrigger>
          </TabsList>

          <TabsContent value={0} className="pt-6">
            <UsersImportTab />
          </TabsContent>

          <TabsContent value={1} className="pt-6">
            <TicketsImportTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
