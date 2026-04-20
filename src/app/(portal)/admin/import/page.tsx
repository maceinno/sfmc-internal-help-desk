'use client'

import { useCallback, useRef, useState } from 'react'
import {
  Upload,
  Download,
  FileText,
  Check,
  AlertTriangle,
  AlertCircle,
  Users,
  Loader2,
  CheckCircle2,
  XCircle,
  RefreshCw,
} from 'lucide-react'

// ============================================================================
// Types
// ============================================================================

type RowStatus = 'valid' | 'warning' | 'error'
type ImportStep = 'upload' | 'preview' | 'importing' | 'complete'

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

// ============================================================================
// Constants
// ============================================================================

const VALID_ROLES = ['employee', 'agent', 'admin']

const USER_CSV_TEMPLATE = `Name,Email,Role,Department,Team,Branch,Region
Jane Smith,jane.smith@sfmc.com,employee,Loan Support,Lending Support,Downtown Branch,Aldridge
Bob Johnson,bob.johnson@sfmc.com,agent,System Support,IT Support,Midtown Office,GW
Alice Brown,alice.brown@sfmc.com,admin,Administration,Closing Support,Corporate HQ,Corporate`

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
// Users Import
// ============================================================================

function UsersImport() {
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
// Main Page
// ============================================================================

export default function AdminImportPage() {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Bulk Import</h1>
        <p className="text-gray-500 mt-1">Import users from a CSV file</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <UsersImport />
      </div>
    </div>
  )
}
