import AsyncStorage from "@react-native-async-storage/async-storage"

export interface Member {
  id: string
  name: string
  phone?: string
  email?: string
  joinDate: string
  totalContributions?: number
  totalAmount?: number
  lastContribution?: string
  isActive: boolean
  notes?: string
  tags?: string[]
}

class MemberServiceClass {
  private readonly MEMBERS_KEY = "members"
  private members: Member[] = []

  async initialize() {
    await this.loadMembers()
    console.log("MemberService initialized")
  }

  async getAllMembers(): Promise<Member[]> {
    return [...this.members]
  }

  async getMemberById(id: string): Promise<Member | null> {
    return this.members.find((member) => member.id === id) || null
  }

  async getMemberByName(name: string): Promise<Member | null> {
    return this.members.find((member) => member.name.toLowerCase() === name.toLowerCase()) || null
  }

  async createMember(memberData: Omit<Member, "id" | "isActive">): Promise<string> {
    const newMember: Member = {
      ...memberData,
      id: `member_${Date.now()}`,
      isActive: true,
    }

    this.members.push(newMember)
    await this.saveMembers()
    return newMember.id
  }

  async updateMember(id: string, updates: Partial<Member>) {
    const index = this.members.findIndex((member) => member.id === id)
    if (index === -1) throw new Error("Member not found")

    this.members[index] = { ...this.members[index], ...updates }
    await this.saveMembers()
  }

  async updateMemberStats(memberId: string, contributionAmount: number, contributionDate: string) {
    const member = this.members.find((m) => m.id === memberId)
    if (!member) return

    member.totalContributions = (member.totalContributions || 0) + 1
    member.totalAmount = (member.totalAmount || 0) + contributionAmount
    member.lastContribution = contributionDate

    await this.saveMembers()
  }

  async searchMembers(query: string): Promise<Member[]> {
    const lowercaseQuery = query.toLowerCase()
    return this.members.filter(
      (member) =>
        member.name.toLowerCase().includes(lowercaseQuery) ||
        member.phone?.toLowerCase().includes(lowercaseQuery) ||
        member.email?.toLowerCase().includes(lowercaseQuery),
    )
  }

  private async loadMembers() {
    try {
      const stored = await AsyncStorage.getItem(this.MEMBERS_KEY)
      if (stored) {
        this.members = JSON.parse(stored)
      }
    } catch (error) {
      console.error("Error loading members:", error)
    }
  }

  private async saveMembers() {
    try {
      await AsyncStorage.setItem(this.MEMBERS_KEY, JSON.stringify(this.members))
    } catch (error) {
      console.error("Error saving members:", error)
    }
  }
}

export const MemberService = new MemberServiceClass()
