"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { View, StyleSheet, FlatList, Alert } from "react-native"
import {
  Card,
  Title,
  Text,
  TextInput,
  Button,
  List,
  Chip,
  IconButton,
  Divider,
  Portal,
  Dialog,
} from "react-native-paper"
import ColorPicker from "react-native-wheel-color-picker"

import { CategoryService, type Tag } from "../services/CategoryService"

interface TagManagerProps {
  tags: Tag[]
  onComplete: () => void
}

const TagManager: React.FC<TagManagerProps> = ({ tags, onComplete }) => {
  const [localTags, setLocalTags] = useState<Tag[]>([])
  const [newTagName, setNewTagName] = useState("")
  const [newTagColor, setNewTagColor] = useState("#2196F3")
  const [newTagDescription, setNewTagDescription] = useState("")
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [editingTag, setEditingTag] = useState<Tag | null>(null)
  const [showEditDialog, setShowEditDialog] = useState(false)

  useEffect(() => {
    setLocalTags([...tags])
  }, [tags])

  const handleCreateTag = async () => {
    if (!newTagName.trim()) {
      Alert.alert("Error", "Tag name is required")
      return
    }

    try {
      await CategoryService.createTag({
        name: newTagName.trim(),
        color: newTagColor,
        description: newTagDescription.trim(),
        isSystem: false,
      })

      setNewTagName("")
      setNewTagDescription("")
      setNewTagColor("#2196F3")
      onComplete()
    } catch (error) {
      Alert.alert("Error", "Failed to create tag")
    }
  }

  const handleUpdateTag = async () => {
    if (!editingTag) return

    try {
      await CategoryService.updateTag(editingTag.id, {
        name: editingTag.name,
        color: editingTag.color,
        description: editingTag.description,
      })

      setShowEditDialog(false)
      setEditingTag(null)
      onComplete()
    } catch (error) {
      Alert.alert("Error", "Failed to update tag")
    }
  }

  const handleDeleteTag = async (tagId: string) => {
    Alert.alert("Delete Tag", "Are you sure you want to delete this tag? This action cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await CategoryService.deleteTag(tagId)
            onComplete()
          } catch (error) {
            Alert.alert("Error", "Failed to delete tag")
          }
        },
      },
    ])
  }

  const openEditDialog = (tag: Tag) => {
    setEditingTag({ ...tag })
    setShowEditDialog(true)
  }

  const renderTagItem = ({ item }: { item: Tag }) => (
    <List.Item
      title={item.name}
      description={`${item.description || "No description"} • Used ${item.usageCount} times`}
      left={() => <View style={[styles.tagColorIndicator, { backgroundColor: item.color }]} />}
      right={() => (
        <View style={styles.tagActions}>
          <IconButton icon="edit" size={20} onPress={() => openEditDialog(item)} />
          {!item.isSystem && <IconButton icon="delete" size={20} onPress={() => handleDeleteTag(item.id)} />}
        </View>
      )}
      style={styles.tagItem}
    />
  )

  const sortedTags = localTags.sort((a, b) => {
    if (a.isSystem && !b.isSystem) return -1
    if (!a.isSystem && b.isSystem) return 1
    return b.usageCount - a.usageCount
  })

  return (
    <View style={styles.container}>
      {/* Create New Tag */}
      <Card style={styles.createCard}>
        <Card.Content>
          <Title style={styles.cardTitle}>Create New Tag</Title>

          <TextInput
            label="Tag Name"
            value={newTagName}
            onChangeText={setNewTagName}
            mode="outlined"
            style={styles.input}
            placeholder="e.g., urgent, verified"
          />

          <TextInput
            label="Description (Optional)"
            value={newTagDescription}
            onChangeText={setNewTagDescription}
            mode="outlined"
            style={styles.input}
            placeholder="Brief description of this tag"
          />

          <View style={styles.colorSection}>
            <Text style={styles.colorLabel}>Color</Text>
            <View style={styles.colorRow}>
              <View style={[styles.colorPreview, { backgroundColor: newTagColor }]} />
              <Button mode="outlined" onPress={() => setShowColorPicker(!showColorPicker)} style={styles.colorButton}>
                {newTagColor}
              </Button>
            </View>
          </View>

          {showColorPicker && (
            <View style={styles.colorPickerContainer}>
              <ColorPicker
                color={newTagColor}
                onColorChange={setNewTagColor}
                thumbSize={30}
                sliderSize={30}
                noSnap={true}
                row={false}
                style={styles.colorPicker}
              />
            </View>
          )}

          <Button
            mode="contained"
            onPress={handleCreateTag}
            style={styles.createButton}
            disabled={!newTagName.trim()}
            icon="tag"
          >
            Create Tag
          </Button>
        </Card.Content>
      </Card>

      {/* Existing Tags */}
      <Card style={styles.tagsListCard}>
        <Card.Content>
          <Title style={styles.cardTitle}>Existing Tags ({localTags.length})</Title>

          {localTags.length === 0 ? (
            <Text style={styles.noTagsText}>No tags created yet</Text>
          ) : (
            <FlatList
              data={sortedTags}
              renderItem={renderTagItem}
              keyExtractor={(item) => item.id}
              style={styles.tagsList}
              ItemSeparatorComponent={() => <Divider />}
              showsVerticalScrollIndicator={false}
            />
          )}
        </Card.Content>
      </Card>

      {/* Tag Statistics */}
      <Card style={styles.statsCard}>
        <Card.Content>
          <Title style={styles.cardTitle}>Tag Statistics</Title>

          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{localTags.length}</Text>
              <Text style={styles.statLabel}>Total Tags</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{localTags.filter((t) => t.isSystem).length}</Text>
              <Text style={styles.statLabel}>System Tags</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{localTags.filter((t) => t.usageCount > 0).length}</Text>
              <Text style={styles.statLabel}>Used Tags</Text>
            </View>
          </View>

          <View style={styles.popularTags}>
            <Text style={styles.popularTagsTitle}>Most Used Tags:</Text>
            <View style={styles.popularTagsContainer}>
              {localTags
                .filter((t) => t.usageCount > 0)
                .sort((a, b) => b.usageCount - a.usageCount)
                .slice(0, 5)
                .map((tag) => (
                  <Chip
                    key={tag.id}
                    style={[styles.popularTagChip, { backgroundColor: tag.color + "20" }]}
                    textStyle={[styles.popularTagText, { color: tag.color }]}
                  >
                    {tag.name} ({tag.usageCount})
                  </Chip>
                ))}
            </View>
          </View>
        </Card.Content>
      </Card>

      {/* Edit Tag Dialog */}
      <Portal>
        <Dialog visible={showEditDialog} onDismiss={() => setShowEditDialog(false)} style={styles.editDialog}>
          <Dialog.Title>Edit Tag</Dialog.Title>
          <Dialog.Content>
            {editingTag && (
              <View>
                <TextInput
                  label="Tag Name"
                  value={editingTag.name}
                  onChangeText={(text) => setEditingTag((prev) => (prev ? { ...prev, name: text } : null))}
                  mode="outlined"
                  style={styles.input}
                />

                <TextInput
                  label="Description"
                  value={editingTag.description || ""}
                  onChangeText={(text) => setEditingTag((prev) => (prev ? { ...prev, description: text } : null))}
                  mode="outlined"
                  style={styles.input}
                />

                <View style={styles.colorSection}>
                  <Text style={styles.colorLabel}>Color</Text>
                  <View style={styles.colorRow}>
                    <View style={[styles.colorPreview, { backgroundColor: editingTag.color }]} />
                    <Text style={styles.colorText}>{editingTag.color}</Text>
                  </View>
                </View>
              </View>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowEditDialog(false)}>Cancel</Button>
            <Button mode="contained" onPress={handleUpdateTag}>
              Save
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    maxHeight: 600,
  },
  createCard: {
    marginBottom: 15,
  },
  tagsListCard: {
    marginBottom: 15,
  },
  statsCard: {
    marginBottom: 15,
  },
  cardTitle: {
    fontSize: 16,
    marginBottom: 15,
    color: "#2E7D32",
  },
  input: {
    marginBottom: 15,
  },
  colorSection: {
    marginBottom: 15,
  },
  colorLabel: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 5,
    color: "#666",
  },
  colorRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  colorPreview: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 10,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  colorButton: {
    flex: 1,
  },
  colorText: {
    fontSize: 14,
    color: "#666",
    flex: 1,
  },
  colorPickerContainer: {
    height: 200,
    marginBottom: 15,
  },
  colorPicker: {
    flex: 1,
  },
  createButton: {
    marginTop: 10,
  },
  tagsList: {
    maxHeight: 300,
  },
  tagItem: {
    paddingVertical: 8,
  },
  tagColorIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 10,
    alignSelf: "center",
  },
  tagActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  noTagsText: {
    textAlign: "center",
    color: "#666",
    fontStyle: "italic",
    paddingVertical: 20,
  },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 20,
  },
  statItem: {
    alignItems: "center",
  },
  statValue: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#2E7D32",
  },
  statLabel: {
    fontSize: 12,
    color: "#666",
    textAlign: "center",
  },
  popularTags: {
    marginTop: 10,
  },
  popularTagsTitle: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 10,
    color: "#666",
  },
  popularTagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  popularTagChip: {
    marginBottom: 5,
  },
  popularTagText: {
    fontSize: 12,
  },
  editDialog: {
    maxHeight: "80%",
  },
})

export default TagManager
