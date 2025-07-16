"use client"

import { useState, useEffect } from "react"
import { View, StyleSheet, ScrollView, Alert } from "react-native"
import {
  Card,
  Title,
  Text,
  Button,
  Chip,
  FAB,
  Portal,
  Dialog,
  Switch,
  IconButton,
  ProgressBar,
} from "react-native-paper"
import Icon from "react-native-vector-icons/MaterialIcons"

import { CategoryService, type Category, type Tag, type CategoryStats } from "../services/CategoryService"
import CategoryEditor from "../components/CategoryEditor"
import TagManager from "../components/TagManager"
import CategoryAnalytics from "../components/CategoryAnalytics"

const CategoriesScreen = () => {
  const [categories, setCategories] = useState<Category[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [categoryStats, setCategoryStats] = useState<Record<string, CategoryStats>>({})
  const [loading, setLoading] = useState(true)

  const [dialogs, setDialogs] = useState({
    createCategory: false,
    editCategory: false,
    tagManager: false,
    analytics: false,
    categoryRules: false,
  })

  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null)
  const [viewMode, setViewMode] = useState<"list" | "hierarchy" | "stats">("list")

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [categoriesData, tagsData] = await Promise.all([CategoryService.getCategories(), CategoryService.getTags()])

      setCategories(categoriesData)
      setTags(tagsData)

      // Load stats for each category
      const stats: Record<string, CategoryStats> = {}
      for (const category of categoriesData) {
        stats[category.id] = await CategoryService.getCategoryStats(category.id)
      }
      setCategoryStats(stats)
    } catch (error) {
      console.error("Error loading categories:", error)
      Alert.alert("Error", "Failed to load categories")
    } finally {
      setLoading(false)
    }
  }

  const handleCreateCategory = async (categoryData: any) => {
    try {
      await CategoryService.createCategory(categoryData)
      await loadData()
      closeDialog("createCategory")
    } catch (error) {
      Alert.alert("Error", "Failed to create category")
    }
  }

  const handleUpdateCategory = async (id: string, updates: any) => {
    try {
      await CategoryService.updateCategory(id, updates)
      await loadData()
      closeDialog("editCategory")
    } catch (error) {
      Alert.alert("Error", "Failed to update category")
    }
  }

  const handleDeleteCategory = async (id: string) => {
    Alert.alert("Delete Category", "Are you sure you want to delete this category? This action cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await CategoryService.deleteCategory(id)
            await loadData()
          } catch (error) {
            Alert.alert("Error", "Failed to delete category")
          }
        },
      },
    ])
  }

  const handleToggleCategory = async (id: string, isActive: boolean) => {
    try {
      await CategoryService.updateCategory(id, { isActive })
      await loadData()
    } catch (error) {
      Alert.alert("Error", "Failed to update category")
    }
  }

  const openDialog = (dialog: keyof typeof dialogs) => {
    setDialogs((prev) => ({ ...prev, [dialog]: true }))
  }

  const closeDialog = (dialog: keyof typeof dialogs) => {
    setDialogs((prev) => ({ ...prev, [dialog]: false }))
    setSelectedCategory(null)
  }

  const renderCategoryCard = (category: Category) => {
    const stats = categoryStats[category.id]
    const hasRules = category.rules && category.rules.length > 0

    return (
      <Card key={category.id} style={styles.categoryCard}>
        <Card.Content>
          <View style={styles.categoryHeader}>
            <View style={styles.categoryInfo}>
              <View style={styles.categoryTitleRow}>
                <View style={[styles.categoryIcon, { backgroundColor: category.color + "20" }]}>
                  <Icon name={category.icon} size={24} color={category.color} />
                </View>
                <View style={styles.categoryDetails}>
                  <Text style={styles.categoryName}>{category.name}</Text>
                  <Text style={styles.categoryDescription}>{category.description}</Text>
                </View>
              </View>

              <View style={styles.categoryMeta}>
                {category.isDefault && (
                  <Chip style={styles.defaultChip} textStyle={styles.defaultChipText}>
                    Default
                  </Chip>
                )}
                {hasRules && (
                  <Chip style={styles.rulesChip} textStyle={styles.rulesChipText} icon="rule">
                    Auto
                  </Chip>
                )}
              </View>
            </View>

            <View style={styles.categoryActions}>
              <Switch
                value={category.isActive}
                onValueChange={(isActive) => handleToggleCategory(category.id, isActive)}
              />
              <IconButton
                icon="edit"
                size={20}
                onPress={() => {
                  setSelectedCategory(category)
                  openDialog("editCategory")
                }}
              />
              {!category.isDefault && (
                <IconButton icon="delete" size={20} onPress={() => handleDeleteCategory(category.id)} />
              )}
            </View>
          </View>

          {stats && (
            <View style={styles.categoryStats}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>${stats.totalAmount.toFixed(2)}</Text>
                <Text style={styles.statLabel}>Total</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{stats.contributionCount}</Text>
                <Text style={styles.statLabel}>Count</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>${stats.averageAmount.toFixed(2)}</Text>
                <Text style={styles.statLabel}>Average</Text>
              </View>
            </View>
          )}

          {hasRules && (
            <View style={styles.rulesPreview}>
              <Text style={styles.rulesTitle}>Auto-categorization Rules:</Text>
              {category.rules!.slice(0, 2).map((rule, index) => (
                <Text key={index} style={styles.ruleText}>
                  • {rule.field} {rule.operator} {String(rule.value)}
                </Text>
              ))}
              {category.rules!.length > 2 && (
                <Text style={styles.moreRules}>+{category.rules!.length - 2} more rules</Text>
              )}
            </View>
          )}
        </Card.Content>
      </Card>
    )
  }

  const renderTagsOverview = () => {
    const popularTags = tags
      .filter((t) => t.usageCount > 0)
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, 10)

    return (
      <Card style={styles.tagsCard}>
        <Card.Content>
          <View style={styles.tagsHeader}>
            <Title style={styles.tagsTitle}>Popular Tags</Title>
            <Button mode="outlined" onPress={() => openDialog("tagManager")} icon="tag" compact>
              Manage
            </Button>
          </View>

          <View style={styles.tagsContainer}>
            {popularTags.map((tag) => (
              <Chip
                key={tag.id}
                style={[styles.tagChip, { backgroundColor: tag.color + "20" }]}
                textStyle={[styles.tagChipText, { color: tag.color }]}
              >
                {tag.name} ({tag.usageCount})
              </Chip>
            ))}
          </View>

          {tags.length === 0 && <Text style={styles.noTagsText}>No tags created yet</Text>}
        </Card.Content>
      </Card>
    )
  }

  const renderViewModeSelector = () => (
    <View style={styles.viewModeSelector}>
      <Button
        mode={viewMode === "list" ? "contained" : "outlined"}
        onPress={() => setViewMode("list")}
        compact
        style={styles.viewModeButton}
      >
        List
      </Button>
      <Button
        mode={viewMode === "hierarchy" ? "contained" : "outlined"}
        onPress={() => setViewMode("hierarchy")}
        compact
        style={styles.viewModeButton}
      >
        Tree
      </Button>
      <Button
        mode={viewMode === "stats" ? "contained" : "outlined"}
        onPress={() => setViewMode("stats")}
        compact
        style={styles.viewModeButton}
      >
        Stats
      </Button>
    </View>
  )

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Loading categories...</Text>
        <ProgressBar indeterminate style={styles.loadingBar} />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Title style={styles.header}>Categories & Tags</Title>

        {/* Quick Stats */}
        <View style={styles.quickStats}>
          <Card style={styles.statCard}>
            <Card.Content style={styles.statContent}>
              <Icon name="category" size={24} color="#2E7D32" />
              <Text style={styles.statNumber}>{categories.length}</Text>
              <Text style={styles.statLabel}>Categories</Text>
            </Card.Content>
          </Card>

          <Card style={styles.statCard}>
            <Card.Content style={styles.statContent}>
              <Icon name="tag" size={24} color="#1976D2" />
              <Text style={styles.statNumber}>{tags.length}</Text>
              <Text style={styles.statLabel}>Tags</Text>
            </Card.Content>
          </Card>

          <Card style={styles.statCard}>
            <Card.Content style={styles.statContent}>
              <Icon name="auto-awesome" size={24} color="#F57C00" />
              <Text style={styles.statNumber}>{categories.filter((c) => c.rules && c.rules.length > 0).length}</Text>
              <Text style={styles.statLabel}>Auto Rules</Text>
            </Card.Content>
          </Card>
        </View>

        {/* Tags Overview */}
        {renderTagsOverview()}

        {/* View Mode Selector */}
        {renderViewModeSelector()}

        {/* Categories List */}
        <View style={styles.categoriesSection}>
          <View style={styles.sectionHeader}>
            <Title style={styles.sectionTitle}>Categories</Title>
            <Button mode="outlined" onPress={() => openDialog("createCategory")} icon="plus" compact>
              Add Category
            </Button>
          </View>

          {categories.length === 0 ? (
            <Card style={styles.emptyCard}>
              <Card.Content style={styles.emptyContent}>
                <Icon name="category" size={48} color="#ccc" />
                <Text style={styles.emptyText}>No categories yet</Text>
                <Button mode="contained" onPress={() => openDialog("createCategory")} style={styles.emptyButton}>
                  Create First Category
                </Button>
              </Card.Content>
            </Card>
          ) : (
            categories.map(renderCategoryCard)
          )}
        </View>

        {/* Quick Actions */}
        <Card style={[styles.actionsCard, styles.lastCard]}>
          <Card.Content>
            <Title style={styles.sectionTitle}>Quick Actions</Title>

            <View style={styles.quickActions}>
              <Button
                mode="outlined"
                onPress={() => openDialog("analytics")}
                icon="analytics"
                style={styles.quickActionButton}
              >
                View Analytics
              </Button>

              <Button
                mode="outlined"
                onPress={() => openDialog("categoryRules")}
                icon="rule"
                style={styles.quickActionButton}
              >
                Manage Rules
              </Button>
            </View>
          </Card.Content>
        </Card>
      </ScrollView>

      {/* Floating Action Button */}
      <FAB icon="add" style={styles.fab} onPress={() => openDialog("createCategory")} />

      {/* Dialogs */}
      <Portal>
        {/* Create/Edit Category */}
        <Dialog
          visible={dialogs.createCategory || dialogs.editCategory}
          onDismiss={() => closeDialog(dialogs.editCategory ? "editCategory" : "createCategory")}
          style={styles.dialog}
        >
          <Dialog.Title>{dialogs.editCategory ? "Edit Category" : "Create Category"}</Dialog.Title>
          <Dialog.ScrollArea>
            <CategoryEditor
              category={selectedCategory}
              onSave={
                selectedCategory ? (data) => handleUpdateCategory(selectedCategory.id, data) : handleCreateCategory
              }
              onCancel={() => closeDialog(dialogs.editCategory ? "editCategory" : "createCategory")}
            />
          </Dialog.ScrollArea>
        </Dialog>

        {/* Tag Manager */}
        <Dialog visible={dialogs.tagManager} onDismiss={() => closeDialog("tagManager")} style={styles.dialog}>
          <Dialog.Title>Tag Manager</Dialog.Title>
          <Dialog.ScrollArea>
            <TagManager
              tags={tags}
              onComplete={() => {
                loadData()
                closeDialog("tagManager")
              }}
            />
          </Dialog.ScrollArea>
        </Dialog>

        {/* Analytics */}
        <Dialog visible={dialogs.analytics} onDismiss={() => closeDialog("analytics")} style={styles.dialog}>
          <Dialog.Title>Category Analytics</Dialog.Title>
          <Dialog.ScrollArea>
            <CategoryAnalytics
              categories={categories}
              categoryStats={categoryStats}
              onClose={() => closeDialog("analytics")}
            />
          </Dialog.ScrollArea>
        </Dialog>
      </Portal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F5F5",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  loadingBar: {
    width: "100%",
    marginTop: 20,
  },
  header: {
    fontSize: 24,
    fontWeight: "bold",
    margin: 20,
    marginBottom: 10,
    color: "#2E7D32",
  },
  quickStats: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  statCard: {
    flex: 1,
    marginHorizontal: 5,
    elevation: 2,
  },
  statContent: {
    alignItems: "center",
    paddingVertical: 15,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: "bold",
    marginVertical: 5,
  },
  statLabel: {
    fontSize: 12,
    textAlign: "center",
    color: "#666",
  },
  tagsCard: {
    marginHorizontal: 20,
    marginBottom: 15,
    elevation: 2,
  },
  tagsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  tagsTitle: {
    fontSize: 18,
    color: "#2E7D32",
  },
  tagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tagChip: {
    marginBottom: 5,
  },
  tagChipText: {
    fontSize: 12,
  },
  noTagsText: {
    textAlign: "center",
    color: "#666",
    fontStyle: "italic",
  },
  viewModeSelector: {
    flexDirection: "row",
    justifyContent: "center",
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  viewModeButton: {
    marginHorizontal: 5,
  },
  categoriesSection: {
    paddingHorizontal: 20,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    color: "#2E7D32",
  },
  categoryCard: {
    marginBottom: 15,
    elevation: 2,
  },
  categoryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 15,
  },
  categoryInfo: {
    flex: 1,
  },
  categoryTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  categoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  categoryDetails: {
    flex: 1,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: "500",
    marginBottom: 2,
  },
  categoryDescription: {
    fontSize: 14,
    color: "#666",
  },
  categoryMeta: {
    flexDirection: "row",
    gap: 8,
  },
  defaultChip: {
    backgroundColor: "#E8F5E8",
    height: 24,
  },
  defaultChipText: {
    fontSize: 12,
    color: "#2E7D32",
  },
  rulesChip: {
    backgroundColor: "#E3F2FD",
    height: 24,
  },
  rulesChipText: {
    fontSize: 12,
    color: "#1976D2",
  },
  categoryActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  categoryStats: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 10,
    backgroundColor: "#F8F8F8",
    borderRadius: 8,
    marginBottom: 10,
  },
  statItem: {
    alignItems: "center",
  },
  statValue: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#2E7D32",
  },
  rulesPreview: {
    backgroundColor: "#F0F8FF",
    padding: 10,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: "#1976D2",
  },
  rulesTitle: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 5,
    color: "#1976D2",
  },
  ruleText: {
    fontSize: 12,
    color: "#666",
    marginBottom: 2,
  },
  moreRules: {
    fontSize: 12,
    color: "#1976D2",
    fontStyle: "italic",
  },
  emptyCard: {
    marginBottom: 15,
  },
  emptyContent: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: "#666",
    marginVertical: 10,
  },
  emptyButton: {
    marginTop: 10,
  },
  actionsCard: {
    marginHorizontal: 20,
    marginBottom: 15,
    elevation: 2,
  },
  lastCard: {
    marginBottom: 100,
  },
  quickActions: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  quickActionButton: {
    flex: 1,
    marginHorizontal: 5,
  },
  fab: {
    position: "absolute",
    margin: 16,
    right: 0,
    bottom: 0,
    backgroundColor: "#2E7D32",
  },
  dialog: {
    maxHeight: "90%",
  },
})

export default CategoriesScreen
