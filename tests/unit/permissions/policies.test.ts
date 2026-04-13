// @vitest-environment node
import { describe, it, expect } from 'vitest'
import type { User, Ticket } from '@/types/ticket'
import {
  canViewTicket,
  canEditTicket,
  canViewInternalNotes,
  canAccessAdmin,
  canViewBranchTickets,
  canViewRegionTickets,
  canAccessDashboard,
  canAccessAgentOverview,
  canAccessReports,
  getAllowedPages,
  filterVisibleTickets,
  filterBranchTickets,
  filterRegionTickets,
} from '@/lib/permissions/policies'

// ============================================================================
// Test fixtures
// ============================================================================

const makeUser = (overrides: Partial<User> & Pick<User, 'id' | 'role'>): User => ({
  name: 'Test User',
  email: 'test@example.com',
  avatar: '',
  ...overrides,
})

const makeTicket = (overrides: Partial<Ticket> & Pick<Ticket, 'id' | 'createdBy'>): Ticket => ({
  title: 'Test Ticket',
  description: 'A test ticket',
  status: 'open',
  priority: 'medium',
  category: 'General',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  messages: [],
  ...overrides,
})

// ---- Users ----------------------------------------------------------------

const adminUser = makeUser({ id: 'admin-1', role: 'admin' })

const agent1 = makeUser({
  id: 'agent-1',
  role: 'agent',
  teamIds: ['team-closing'],
})

const agent2 = makeUser({
  id: 'agent-2',
  role: 'agent',
  teamIds: ['team-it'],
})

const agentBranchManager = makeUser({
  id: 'agent-bm',
  role: 'agent',
  teamIds: ['team-closing'],
  hasBranchAccess: true,
  managedBranchId: 'branch-west',
})

const agentRegionalManager = makeUser({
  id: 'agent-rm',
  role: 'agent',
  teamIds: ['team-closing'],
  hasRegionalAccess: true,
  managedRegionId: 'region-south',
})

const employee1 = makeUser({
  id: 'emp-1',
  role: 'employee',
  branchId: 'branch-west',
  regionId: 'region-south',
})

const employee2 = makeUser({
  id: 'emp-2',
  role: 'employee',
  branchId: 'branch-east',
  regionId: 'region-north',
})

const employeeBranchMgr = makeUser({
  id: 'emp-bm',
  role: 'employee',
  hasBranchAccess: true,
  managedBranchId: 'branch-west',
})

const employeeRegionalMgr = makeUser({
  id: 'emp-rm',
  role: 'employee',
  hasRegionalAccess: true,
  managedRegionId: 'region-south',
})

const allUsers: User[] = [
  adminUser,
  agent1,
  agent2,
  agentBranchManager,
  agentRegionalManager,
  employee1,
  employee2,
  employeeBranchMgr,
  employeeRegionalMgr,
]

// ---- Tickets --------------------------------------------------------------

const ticketByEmp1 = makeTicket({
  id: 'T-1001',
  createdBy: 'emp-1',
  assignedTo: 'agent-1',
  assignedTeam: 'team-closing',
})

const ticketByEmp2 = makeTicket({
  id: 'T-1002',
  createdBy: 'emp-2',
  assignedTo: 'agent-2',
  assignedTeam: 'team-it',
})

const unassignedTicket = makeTicket({
  id: 'T-1003',
  createdBy: 'emp-1',
})

const ccTicket = makeTicket({
  id: 'T-1004',
  createdBy: 'emp-2',
  assignedTeam: 'team-it',
  cc: ['emp-1', 'agent-1'],
})

const allTickets = [ticketByEmp1, ticketByEmp2, unassignedTicket, ccTicket]

// ============================================================================
// canViewTicket
// ============================================================================

describe('canViewTicket', () => {
  it('admin can view any ticket', () => {
    for (const t of allTickets) {
      expect(canViewTicket(adminUser, t, allUsers)).toBe(true)
    }
  })

  it('agent can view ticket assigned to their team', () => {
    expect(canViewTicket(agent1, ticketByEmp1, allUsers)).toBe(true) // team-closing
    expect(canViewTicket(agent1, ticketByEmp2, allUsers)).toBe(false) // team-it
  })

  it('agent can view ticket they are assigned to', () => {
    expect(canViewTicket(agent1, ticketByEmp1, allUsers)).toBe(true)
  })

  it('agent can view ticket they created', () => {
    const agentCreatedTicket = makeTicket({
      id: 'T-9999',
      createdBy: 'agent-2',
      assignedTeam: 'team-closing',
    })
    expect(canViewTicket(agent2, agentCreatedTicket, allUsers)).toBe(true)
  })

  it('agent can view ticket they are CC\'d on', () => {
    expect(canViewTicket(agent1, ccTicket, allUsers)).toBe(true)
  })

  it('agent cannot view unrelated ticket without team/cc/assignment match', () => {
    // agent1 team = team-closing, ticketByEmp2 team = team-it, not CC'd, not assignee
    expect(canViewTicket(agent1, ticketByEmp2, allUsers)).toBe(false)
  })

  it('agent with branch access can view tickets from their branch', () => {
    // emp-1 is in branch-west; agentBranchManager manages branch-west
    expect(canViewTicket(agentBranchManager, unassignedTicket, allUsers)).toBe(true)
  })

  it('agent with region access can view tickets from their region', () => {
    // emp-1 is in region-south; agentRegionalManager manages region-south
    expect(canViewTicket(agentRegionalManager, unassignedTicket, allUsers)).toBe(true)
  })

  it('employee can view their own ticket', () => {
    expect(canViewTicket(employee1, ticketByEmp1, allUsers)).toBe(true)
  })

  it('employee cannot view someone else\'s ticket', () => {
    expect(canViewTicket(employee1, ticketByEmp2, allUsers)).toBe(false)
  })

  it('employee can view ticket they are CC\'d on', () => {
    expect(canViewTicket(employee1, ccTicket, allUsers)).toBe(true)
  })

  it('employee with branch access can see branch tickets', () => {
    // ticketByEmp1 creator emp-1 is in branch-west
    expect(canViewTicket(employeeBranchMgr, ticketByEmp1, allUsers)).toBe(true)
    // ticketByEmp2 creator emp-2 is in branch-east
    expect(canViewTicket(employeeBranchMgr, ticketByEmp2, allUsers)).toBe(false)
  })

  it('employee with region access can see region tickets', () => {
    // emp-1 is in region-south; employeeRegionalMgr manages region-south
    expect(canViewTicket(employeeRegionalMgr, ticketByEmp1, allUsers)).toBe(true)
    // emp-2 is in region-north
    expect(canViewTicket(employeeRegionalMgr, ticketByEmp2, allUsers)).toBe(false)
  })
})

// ============================================================================
// canEditTicket
// ============================================================================

describe('canEditTicket', () => {
  it('admin can edit any ticket', () => {
    expect(canEditTicket(adminUser, ticketByEmp1)).toBe(true)
    expect(canEditTicket(adminUser, ticketByEmp2)).toBe(true)
  })

  it('agent can edit ticket they are assigned to', () => {
    expect(canEditTicket(agent1, ticketByEmp1)).toBe(true)
  })

  it('agent can edit ticket they created', () => {
    const agentTicket = makeTicket({ id: 'T-8000', createdBy: 'agent-1' })
    expect(canEditTicket(agent1, agentTicket)).toBe(true)
  })

  it('agent cannot edit unrelated ticket', () => {
    expect(canEditTicket(agent1, ticketByEmp2)).toBe(false)
  })

  it('employee can edit their own ticket', () => {
    expect(canEditTicket(employee1, ticketByEmp1)).toBe(true)
  })

  it('employee cannot edit someone else\'s ticket', () => {
    expect(canEditTicket(employee1, ticketByEmp2)).toBe(false)
  })
})

// ============================================================================
// canViewInternalNotes
// ============================================================================

describe('canViewInternalNotes', () => {
  it('admin can view internal notes', () => {
    expect(canViewInternalNotes(adminUser)).toBe(true)
  })

  it('agent can view internal notes', () => {
    expect(canViewInternalNotes(agent1)).toBe(true)
  })

  it('employee cannot view internal notes', () => {
    expect(canViewInternalNotes(employee1)).toBe(false)
  })
})

// ============================================================================
// canAccessAdmin
// ============================================================================

describe('canAccessAdmin', () => {
  it('admin can access admin settings', () => {
    expect(canAccessAdmin(adminUser)).toBe(true)
  })

  it('agent cannot access admin settings', () => {
    expect(canAccessAdmin(agent1)).toBe(false)
  })

  it('employee cannot access admin settings', () => {
    expect(canAccessAdmin(employee1)).toBe(false)
  })
})

// ============================================================================
// canViewBranchTickets / canViewRegionTickets
// ============================================================================

describe('canViewBranchTickets', () => {
  it('returns true for user with branch access and managed branch', () => {
    expect(canViewBranchTickets(agentBranchManager)).toBe(true)
    expect(canViewBranchTickets(employeeBranchMgr)).toBe(true)
  })

  it('returns false for user without branch access', () => {
    expect(canViewBranchTickets(employee1)).toBe(false)
    expect(canViewBranchTickets(agent1)).toBe(false)
  })
})

describe('canViewRegionTickets', () => {
  it('returns true for user with region access and managed region', () => {
    expect(canViewRegionTickets(agentRegionalManager)).toBe(true)
    expect(canViewRegionTickets(employeeRegionalMgr)).toBe(true)
  })

  it('returns false for user without region access', () => {
    expect(canViewRegionTickets(employee1)).toBe(false)
    expect(canViewRegionTickets(agent1)).toBe(false)
  })
})

// ============================================================================
// canAccessDashboard / canAccessAgentOverview / canAccessReports
// ============================================================================

describe('canAccessDashboard', () => {
  it('admin and agent can access dashboard', () => {
    expect(canAccessDashboard(adminUser)).toBe(true)
    expect(canAccessDashboard(agent1)).toBe(true)
  })

  it('employee cannot access dashboard', () => {
    expect(canAccessDashboard(employee1)).toBe(false)
  })
})

describe('canAccessAgentOverview', () => {
  it('admin and agent can access agent overview', () => {
    expect(canAccessAgentOverview(adminUser)).toBe(true)
    expect(canAccessAgentOverview(agent1)).toBe(true)
  })

  it('employee cannot access agent overview', () => {
    expect(canAccessAgentOverview(employee1)).toBe(false)
  })
})

describe('canAccessReports', () => {
  it('admin and agent can access reports', () => {
    expect(canAccessReports(adminUser)).toBe(true)
    expect(canAccessReports(agent1)).toBe(true)
  })

  it('employee cannot access reports', () => {
    expect(canAccessReports(employee1)).toBe(false)
  })
})

// ============================================================================
// getAllowedPages
// ============================================================================

describe('getAllowedPages', () => {
  it('admin gets all pages including admin-settings', () => {
    const pages = getAllowedPages(adminUser)
    expect(pages).toContain('admin-settings')
    expect(pages).toContain('dashboard')
    expect(pages).toContain('agent-overview')
    expect(pages).toContain('reports')
    expect(pages).toContain('my-tickets')
    expect(pages).toContain('create-ticket')
  })

  it('agent gets agent pages but not admin-settings', () => {
    const pages = getAllowedPages(agent1)
    expect(pages).toContain('dashboard')
    expect(pages).toContain('agent-overview')
    expect(pages).toContain('reports')
    expect(pages).not.toContain('admin-settings')
  })

  it('employee gets only employee pages', () => {
    const pages = getAllowedPages(employee1)
    expect(pages).toContain('my-tickets')
    expect(pages).toContain('cc-tickets')
    expect(pages).toContain('create-ticket')
    expect(pages).toContain('ticket-detail')
    expect(pages).not.toContain('dashboard')
    expect(pages).not.toContain('admin-settings')
    expect(pages).not.toContain('agent-overview')
    expect(pages).not.toContain('reports')
  })

  it('branch manager gets my-branch page', () => {
    const pages = getAllowedPages(agentBranchManager)
    expect(pages).toContain('my-branch')
  })

  it('regional manager gets my-region page', () => {
    const pages = getAllowedPages(agentRegionalManager)
    expect(pages).toContain('my-region')
  })

  it('user without branch/region access does not get those pages', () => {
    const pages = getAllowedPages(employee1)
    expect(pages).not.toContain('my-branch')
    expect(pages).not.toContain('my-region')
  })
})

// ============================================================================
// filterVisibleTickets
// ============================================================================

describe('filterVisibleTickets', () => {
  it('admin sees all tickets', () => {
    const result = filterVisibleTickets(adminUser, allTickets, allUsers)
    expect(result).toHaveLength(allTickets.length)
  })

  it('agent sees only team/assigned/created/CC tickets', () => {
    const result = filterVisibleTickets(agent1, allTickets, allUsers)
    // agent1 (team-closing): ticketByEmp1 (team-closing), ccTicket (CC'd)
    expect(result).toContain(ticketByEmp1)
    expect(result).toContain(ccTicket)
    expect(result).not.toContain(ticketByEmp2)
    // unassignedTicket has no team, agent1 is not creator/assignee/CC
    expect(result).not.toContain(unassignedTicket)
  })

  it('employee sees only own and CC\'d tickets', () => {
    const result = filterVisibleTickets(employee1, allTickets, allUsers)
    expect(result).toContain(ticketByEmp1)     // own
    expect(result).toContain(unassignedTicket)  // own
    expect(result).toContain(ccTicket)          // CC'd
    expect(result).not.toContain(ticketByEmp2)  // someone else's
  })
})

// ============================================================================
// filterBranchTickets
// ============================================================================

describe('filterBranchTickets', () => {
  it('returns branch-matching tickets for branch manager', () => {
    const result = filterBranchTickets(agentBranchManager, allTickets, allUsers)
    // emp-1 is in branch-west, emp-2 is in branch-east
    // ticketByEmp1 (creator emp-1 branch-west) -> match
    // ticketByEmp2 (creator emp-2 branch-east) -> no match
    // unassignedTicket (creator emp-1 branch-west) -> match
    // ccTicket (creator emp-2 branch-east) -> no match
    expect(result).toContain(ticketByEmp1)
    expect(result).toContain(unassignedTicket)
    expect(result).not.toContain(ticketByEmp2)
    expect(result).not.toContain(ccTicket)
  })

  it('returns empty for user without branch access', () => {
    expect(filterBranchTickets(employee1, allTickets, allUsers)).toHaveLength(0)
  })
})

// ============================================================================
// filterRegionTickets
// ============================================================================

describe('filterRegionTickets', () => {
  it('returns region-matching tickets for regional manager', () => {
    const result = filterRegionTickets(agentRegionalManager, allTickets, allUsers)
    // emp-1 region-south -> match, emp-2 region-north -> no match
    expect(result).toContain(ticketByEmp1)
    expect(result).toContain(unassignedTicket)
    expect(result).not.toContain(ticketByEmp2)
    expect(result).not.toContain(ccTicket)
  })

  it('returns empty for user without region access', () => {
    expect(filterRegionTickets(employee1, allTickets, allUsers)).toHaveLength(0)
  })
})
