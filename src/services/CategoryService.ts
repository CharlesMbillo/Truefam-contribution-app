import AsyncStorage from "@react-native-async-storage/async-storage"
import { ContributionService } from "./ContributionService"

export interface Category {
  id: string
  name: string
  description: string
  color: string
  icon: string
  isDefault: boolean
  isActive: boolean
  parentId?: string
  rules?: CategoryRule[]
  createdAt: string
  updatedAt: string
}

export interface Tag {
  id: string
  name: string
  color: string
  description?: string
  usageCount: number
  createdAt: string
  isSystem: boolean
}

export interface CategoryRule {
  id: string
  field: "amount" | "platform" | "memberName" | "notes" | "time" | "frequency"
  operator: "equals" | "contains" | "greater_than" | "less_than" | "between" | "in_list"
  value: any
  priority: number
}

export interface FilterCriteria {
  categories?: string[]
  tags?: string[]
  dateRange?: {
    start: Date
    end: Date
  }
  amountRange?: {
    min: number
    max: number
  }
  platforms?: string[]
  members?: string[]
  searchText?: string
  sortBy?: "date" | "amount" | "member" | "category"
  sortOrder?: "asc" | "desc"
  groupBy?: "category" | "tag" | "member" | "platform" | "date"
}

export interface CategoryStats {
  categoryId: string
  totalAmount: number
  contributionCount: number
  averageAmount: number
  lastContribution: string
  topContributors: Array<{
    memberId: string
    memberName: string
    amount: number
    count: number
  }>
  monthlyTrend: Array<{
    month: string
    amount: number
    count: number
  }>
}

class CategoryServiceClass {
  private categories: Category[] = []
  private tags: Tag[] = []

  private readonly CATEGORIES_KEY = "categories"
  private readonly TAGS_KEY = "tags"

  async initialize() {
    await this.loadCategories()
    await this.loadTags()
    await this.setupDefaultCategories()
    await this.setupSystemTags()
    console.log("CategoryService initialized")
  }

  // Category Management
  async getCategories(): Promise<Category[]> {
    return [...this.categories.filter((c) => c.isActive)]
  }

  async getCategoryById(id: string): Promise<Category | null> {
    return this.categories.find((c) => c.id === id) || null
  }

  async createCategory(categoryData: Omit<Category, "id" | "createdAt" | "updatedAt">): Promise<string> {
    const newCategory: Category = {
      ...categoryData,
      id: `category_${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    this.categories.push(newCategory)
    await this.saveCategories()
    return newCategory.id
  }

  async updateCategory(id: string, updates: Partial<Category>) {
    const index = this.categories.findIndex((c) => c.id === id)
    if (index === -1) throw new Error("Category not found")

    this.categories[index] = {
      ...this.categories[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    }

    await this.saveCategories()
  }

  async deleteCategory(id: string) {
    const category = this.categories.find((c) => c.id === id)
    if (!category) throw new Error("Category not found")

    if (category.isDefault) {
      throw new Error("Cannot delete default category")
    }

    // Soft delete
    await this.updateCategory(id, { isActive: false })
  }

  async getCategoryHierarchy(): Promise<Category[]> {
    const rootCategories = this.categories.filter((c) => !c.parentId && c.isActive)

    const buildHierarchy = (parentId?: string): Category[] => {
      return this.categories
        .filter((c) => c.parentId === parentId && c.isActive)
        .map((category) => ({
          ...category,
          children: buildHierarchy(category.id),
        }))
    }

    return rootCategories.map((category) => ({
      ...category,
      children: buildHierarchy(category.id),
    }))
  }

  // Tag Management
  async getTags(): Promise<Tag[]> {
    return [...this.tags]
  }

  async getTagById(id: string): Promise<Tag | null> {
    return this.tags.find((t) => t.id === id) || null
  }

  async createTag(tagData: Omit<Tag, "id" | "createdAt" | "usageCount">): Promise<string> {
    // Check if tag already exists
    const existing = this.tags.find((t) => t.name.toLowerCase() === tagData.name.toLowerCase())
    if (existing) {
      return existing.id
    }

    const newTag: Tag = {
      ...tagData,
      id: `tag_${Date.now()}`,
      usageCount: 0,
      createdAt: new Date().toISOString(),
    }

    this.tags.push(newTag)
    await this.saveTags()
    return newTag.id
  }

  async updateTag(id: string, updates: Partial<Tag>) {
    const index = this.tags.findIndex((t) => t.id === id)
    if (index === -1) throw new Error("Tag not found")

    this.tags[index] = { ...this.tags[index], ...updates }
    await this.saveTags()
  }

  async deleteTag(id: string) {
    const tag = this.tags.find((t) => t.id === id)
    if (!tag) throw new Error("Tag not found")

    if (tag.isSystem) {
      throw new Error("Cannot delete system tag")
    }

    this.tags = this.tags.filter((t) => t.id !== id)
    await this.saveTags()
  }

  async incrementTagUsage(tagId: string) {
    const tag = this.tags.find((t) => t.id === tagId)
    if (tag) {
      tag.usageCount++
      await this.saveTags()
    }
  }

  async getPopularTags(limit = 10): Promise<Tag[]> {
    return this.tags
      .filter((t) => t.usageCount > 0)
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, limit)
  }

  // Auto-categorization
  async suggestCategory(contribution: any): Promise<Category | null> {
    const activeCategories = this.categories.filter((c) => c.isActive && c.rules && c.rules.length > 0)

    let bestMatch: { category: Category; score: number } | null = null

    for (const category of activeCategories) {
      const score = this.calculateCategoryScore(contribution, category)
      if (score > 0 && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { category, score }
      }
    }

    return bestMatch?.category || null
  }

  async suggestTags(contribution: any): Promise<Tag[]> {
    const suggestions: Tag[] = []

    // Amount-based tags
    if (contribution.amount >= 1000) {
      suggestions.push(await this.getOrCreateTag("large-amount", "#FF5722"))
    } else if (contribution.amount >= 500) {
      suggestions.push(await this.getOrCreateTag("medium-amount", "#FF9800"))
    }

    // Platform-based tags
    suggestions.push(await this.getOrCreateTag(`platform-${contribution.platform}`, "#2196F3"))

    // Time-based tags
    const date = new Date(contribution.date)
    const hour = date.getHours()
    if (hour >= 18 || hour <= 6) {
      suggestions.push(await this.getOrCreateTag("after-hours", "#9C27B0"))
    }

    // Frequency-based tags (if member has multiple contributions)
    const memberContributions = await ContributionService.getContributionsByMember(contribution.memberId)
    if (memberContributions.length > 10) {
      suggestions.push(await this.getOrCreateTag("frequent-contributor", "#4CAF50"))
    }

    return suggestions.filter(Boolean)
  }

  private calculateCategoryScore(contribution: any, category: Category): number {
    if (!category.rules) return 0

    let totalScore = 0
    let matchedRules = 0

    for (const rule of category.rules) {
      if (this.evaluateRule(contribution, rule)) {
        totalScore += rule.priority
        matchedRules++
      }
    }

    // Return weighted score
    return matchedRules > 0 ? totalScore / category.rules.length : 0
  }

  private evaluateRule(contribution: any, rule: CategoryRule): boolean {
    const fieldValue = this.getFieldValue(contribution, rule.field)

    switch (rule.operator) {
      case "equals":
        return fieldValue === rule.value
      case "contains":
        return String(fieldValue).toLowerCase().includes(String(rule.value).toLowerCase())
      case "greater_than":
        return Number(fieldValue) > Number(rule.value)
      case "less_than":
        return Number(fieldValue) < Number(rule.value)
      case "between":
        return Number(fieldValue) >= rule.value.min && Number(fieldValue) <= rule.value.max
      case "in_list":
        return Array.isArray(rule.value) && rule.value.includes(fieldValue)
      default:
        return false
    }
  }

  private getFieldValue(contribution: any, field: string): any {
    switch (field) {
      case "amount":
        return contribution.amount
      case "platform":
        return contribution.platform
      case "memberName":
        return contribution.memberName
      case "notes":
        return contribution.notes || ""
      case "time":
        return new Date(contribution.date).getHours()
      case "frequency":
        // This would need to be calculated based on member's contribution history
        return 1
      default:
        return null
    }
  }

  private async getOrCreateTag(name: string, color: string): Promise<Tag> {
    let tag = this.tags.find((t) => t.name === name)
    if (!tag) {
      const tagId = await this.createTag({
        name,
        color,
        isSystem: true,
      })
      tag = this.tags.find((t) => t.id === tagId)!
    }
    return tag
  }

  // Filtering and Search
  async filterContributions(criteria: FilterCriteria): Promise<any[]> {
    let contributions = await ContributionService.getAllContributions()

    // Apply filters
    if (criteria.categories && criteria.categories.length > 0) {
      contributions = contributions.filter((c) => criteria.categories!.includes(c.category))
    }

    if (criteria.tags && criteria.tags.length > 0) {
      contributions = contributions.filter((c) => c.tags && c.tags.some((tag: string) => criteria.tags!.includes(tag)))
    }

    if (criteria.dateRange) {
      contributions = contributions.filter((c) => {
        const date = new Date(c.date)
        return date >= criteria.dateRange!.start && date <= criteria.dateRange!.end
      })
    }

    if (criteria.amountRange) {
      contributions = contributions.filter(
        (c) => c.amount >= criteria.amountRange!.min && c.amount <= criteria.amountRange!.max,
      )
    }

    if (criteria.platforms && criteria.platforms.length > 0) {
      contributions = contributions.filter((c) => criteria.platforms!.includes(c.platform))
    }

    if (criteria.members && criteria.members.length > 0) {
      contributions = contributions.filter((c) => criteria.members!.includes(c.memberId))
    }

    if (criteria.searchText) {
      const searchLower = criteria.searchText.toLowerCase()
      contributions = contributions.filter(
        (c) =>
          c.memberName.toLowerCase().includes(searchLower) ||
          (c.notes && c.notes.toLowerCase().includes(searchLower)) ||
          c.platform.toLowerCase().includes(searchLower),
      )
    }

    // Apply sorting
    if (criteria.sortBy) {
      contributions.sort((a, b) => {
        let aValue, bValue

        switch (criteria.sortBy) {
          case "date":
            aValue = new Date(a.date).getTime()
            bValue = new Date(b.date).getTime()
            break
          case "amount":
            aValue = a.amount
            bValue = b.amount
            break
          case "member":
            aValue = a.memberName.toLowerCase()
            bValue = b.memberName.toLowerCase()
            break
          case "category":
            aValue = a.category || ""
            bValue = b.category || ""
            break
          default:
            return 0
        }

        if (criteria.sortOrder === "desc") {
          return bValue > aValue ? 1 : -1
        }
        return aValue > bValue ? 1 : -1
      })
    }

    return contributions
  }

  async groupContributions(contributions: any[], groupBy: string): Promise<Record<string, any[]>> {
    const groups: Record<string, any[]> = {}

    for (const contribution of contributions) {
      let groupKey: string

      switch (groupBy) {
        case "category":
          groupKey = contribution.category || "Uncategorized"
          break
        case "tag":
          groupKey = contribution.tags && contribution.tags.length > 0 ? contribution.tags[0] : "Untagged"
          break
        case "member":
          groupKey = contribution.memberName
          break
        case "platform":
          groupKey = contribution.platform
          break
        case "date":
          groupKey = new Date(contribution.date).toLocaleDateString()
          break
        default:
          groupKey = "All"
      }

      if (!groups[groupKey]) {
        groups[groupKey] = []
      }
      groups[groupKey].push(contribution)
    }

    return groups
  }

  // Analytics
  async getCategoryStats(categoryId: string): Promise<CategoryStats> {
    const contributions = await ContributionService.getAllContributions()
    const categoryContributions = contributions.filter((c) => c.category === categoryId)

    const totalAmount = categoryContributions.reduce((sum, c) => sum + c.amount, 0)
    const contributionCount = categoryContributions.length
    const averageAmount = contributionCount > 0 ? totalAmount / contributionCount : 0
    const lastContribution =
      categoryContributions.length > 0
        ? categoryContributions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0].date
        : ""

    // Top contributors
    const contributorMap = new Map()
    categoryContributions.forEach((c) => {
      const key = c.memberId
      if (!contributorMap.has(key)) {
        contributorMap.set(key, {
          memberId: c.memberId,
          memberName: c.memberName,
          amount: 0,
          count: 0,
        })
      }
      const contributor = contributorMap.get(key)
      contributor.amount += c.amount
      contributor.count += 1
    })

    const topContributors = Array.from(contributorMap.values())
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5)

    // Monthly trend
    const monthlyMap = new Map()
    categoryContributions.forEach((c) => {
      const date = new Date(c.date)
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`

      if (!monthlyMap.has(monthKey)) {
        monthlyMap.set(monthKey, { month: monthKey, amount: 0, count: 0 })
      }
      const monthData = monthlyMap.get(monthKey)
      monthData.amount += c.amount
      monthData.count += 1
    })

    const monthlyTrend = Array.from(monthlyMap.values()).sort((a, b) => a.month.localeCompare(b.month))

    return {
      categoryId,
      totalAmount,
      contributionCount,
      averageAmount,
      lastContribution,
      topContributors,
      monthlyTrend,
    }
  }

  async getTagStats(): Promise<Array<{ tag: Tag; stats: any }>> {
    const contributions = await ContributionService.getAllContributions()
    const tagStats = new Map()

    contributions.forEach((c) => {
      if (c.tags) {
        c.tags.forEach((tagId: string) => {
          if (!tagStats.has(tagId)) {
            tagStats.set(tagId, {
              count: 0,
              totalAmount: 0,
              lastUsed: c.date,
            })
          }
          const stats = tagStats.get(tagId)
          stats.count += 1
          stats.totalAmount += c.amount
          if (new Date(c.date) > new Date(stats.lastUsed)) {
            stats.lastUsed = c.date
          }
        })
      }
    })

    const result = []
    for (const [tagId, stats] of tagStats.entries()) {
      const tag = this.tags.find((t) => t.id === tagId)
      if (tag) {
        result.push({ tag, stats })
      }
    }

    return result.sort((a, b) => b.stats.count - a.stats.count)
  }

  // Default setup
  private async setupDefaultCategories() {
    if (this.categories.length === 0) {
      const defaultCategories = [
        {
          name: "General Contribution",
          description: "Regular member contributions",
          color: "#4CAF50",
          icon: "attach-money",
          isDefault: true,
          isActive: true,
        },
        {
          name: "Monthly Dues",
          description: "Regular monthly membership fees",
          color: "#2196F3",
          icon: "event-repeat",
          isDefault: true,
          isActive: true,
          rules: [
            {
              id: "rule_1",
              field: "frequency" as const,
              operator: "equals" as const,
              value: "monthly",
              priority: 10,
            },
          ],
        },
        {
          name: "Special Events",
          description: "Contributions for special occasions",
          color: "#FF9800",
          icon: "celebration",
          isDefault: true,
          isActive: true,
        },
        {
          name: "Emergency Fund",
          description: "Emergency assistance contributions",
          color: "#F44336",
          icon: "emergency",
          isDefault: true,
          isActive: true,
          rules: [
            {
              id: "rule_2",
              field: "notes" as const,
              operator: "contains" as const,
              value: "emergency",
              priority: 8,
            },
          ],
        },
        {
          name: "Large Donations",
          description: "Significant one-time contributions",
          color: "#9C27B0",
          icon: "volunteer-activism",
          isDefault: true,
          isActive: true,
          rules: [
            {
              id: "rule_3",
              field: "amount" as const,
              operator: "greater_than" as const,
              value: 500,
              priority: 9,
            },
          ],
        },
      ]

      for (const category of defaultCategories) {
        await this.createCategory(category)
      }
    }
  }

  private async setupSystemTags() {
    if (this.tags.length === 0) {
      const systemTags = [
        { name: "verified", color: "#4CAF50", description: "Verified contribution", isSystem: true },
        { name: "pending", color: "#FF9800", description: "Pending verification", isSystem: true },
        { name: "recurring", color: "#2196F3", description: "Recurring contribution", isSystem: true },
        { name: "manual-entry", color: "#9E9E9E", description: "Manually entered", isSystem: true },
        { name: "auto-detected", color: "#00BCD4", description: "Automatically detected", isSystem: true },
      ]

      for (const tag of systemTags) {
        await this.createTag(tag)
      }
    }
  }

  // Storage methods
  private async saveCategories() {
    await AsyncStorage.setItem(this.CATEGORIES_KEY, JSON.stringify(this.categories))
  }

  private async loadCategories() {
    try {
      const stored = await AsyncStorage.getItem(this.CATEGORIES_KEY)
      if (stored) {
        this.categories = JSON.parse(stored)
      }
    } catch (error) {
      console.error("Error loading categories:", error)
    }
  }

  private async saveTags() {
    await AsyncStorage.setItem(this.TAGS_KEY, JSON.stringify(this.tags))
  }

  private async loadTags() {
    try {
      const stored = await AsyncStorage.getItem(this.TAGS_KEY)
      if (stored) {
        this.tags = JSON.parse(stored)
      }
    } catch (error) {
      console.error("Error loading tags:", error)
    }
  }
}

export const CategoryService = new CategoryServiceClass()
