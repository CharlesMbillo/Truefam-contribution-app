"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { View, StyleSheet, ScrollView } from "react-native"
import { Card, Title, Text, TextInput, Button, Chip } from "react-native-paper"
import { Picker } from "@react-native-picker/picker"
import DateTimePicker from "@react-native-community/datetimepicker"
import MultiSlider from "@react-native-community/slider"

import { CategoryService, type FilterCriteria, type Category, type Tag } from "../services/CategoryService"
import { MemberService, type Member } from "../services/MemberService"

interface AdvancedFilterProps {
  onApplyFilter: (criteria: FilterCriteria) => void
  onClearFilter: () => void
  initialCriteria?: FilterCriteria
}

const AdvancedFilter: React.FC<AdvancedFilterProps> = ({ onApplyFilter, onClearFilter, initialCriteria }) => {
  const [criteria, setCriteria] = useState<FilterCriteria>(
    initialCriteria || {
      categories: [],
      tags: [],
      platforms: [],
      members: [],
      searchText: "",
      sortBy: "date",
      sortOrder: "desc",
    },
  )

  const [categories, setCategories] = useState<Category[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [showDatePicker, setShowDatePicker] = useState<"start" | "end" | null>(null)
  const [amountRange, setAmountRange] = useState([0, 10000])

  useEffect(() => {
    loadFilterOptions()
  }, [])

  const loadFilterOptions = async () => {
    try {
      const [categoriesData, tagsData, membersData] = await Promise.all([
        CategoryService.getCategories(),
        CategoryService.getTags(),
        MemberService.getAllMembers(),
      ])

      setCategories(categoriesData)
      setTags(tagsData)
      setMembers(membersData)
    } catch (error) {
      console.error("Error loading filter options:", error)
    }
  }

  const handleCategoryToggle = (categoryId: string) => {
    const currentCategories = criteria.categories || []
    const newCategories = currentCategories.includes(categoryId)
      ? currentCategories.filter((id) => id !== categoryId)
      : [...currentCategories, categoryId]

    setCriteria((prev) => ({ ...prev, categories: newCategories }))
  }

  const handleTagToggle = (tagId: string) => {
    const currentTags = criteria.tags || []
    const newTags = currentTags.includes(tagId) ? currentTags.filter((id) => id !== tagId) : [...currentTags, tagId]

    setCriteria((prev) => ({ ...prev, tags: newTags }))
  }

  const handleMemberToggle = (memberId: string) => {
    const currentMembers = criteria.members || []
    const newMembers = currentMembers.includes(memberId)
      ? currentMembers.filter((id) => id !== memberId)
      : [...currentMembers, memberId]

    setCriteria((prev) => ({ ...prev, members: newMembers }))
  }

  const handlePlatformToggle = (platform: string) => {
    const currentPlatforms = criteria.platforms || []
    const newPlatforms = currentPlatforms.includes(platform)
      ? currentPlatforms.filter((p) => p !== platform)
      : [...currentPlatforms, platform]

    setCriteria((prev) => ({ ...prev, platforms: newPlatforms }))
  }

  const handleDateChange = (type: "start" | "end", date: Date) => {
    const newDateRange = criteria.dateRange || { start: new Date(), end: new Date() }
    newDateRange[type] = date
    setCriteria((prev) => ({ ...prev, dateRange: newDateRange }))
    setShowDatePicker(null)
  }

  const handleAmountRangeChange = (values: number[]) => {
    setAmountRange(values)
    setCriteria((prev) => ({
      ...prev,
      amountRange: { min: values[0], max: values[1] },
    }))
  }

  const handleApplyFilter = () => {
    onApplyFilter(criteria)
  }

  const handleClearFilter = () => {
    setCriteria({
      categories: [],
      tags: [],
      platforms: [],
      members: [],
      searchText: "",
      sortBy: "date",
      sortOrder: "desc",
    })
    setAmountRange([0, 10000])
    onClearFilter()
  }

  const platforms = [
    { id: "cash", name: "Cash", icon: "money" },
    { id: "zelle", name: "Zelle", icon: "account-balance" },
    { id: "venmo", name: "Venmo", icon: "payment" },
    { id: "cashapp", name: "Cash App", icon: "mobile-friendly" },
    { id: "mpesa", name: "M-PESA", icon: "phone-android" },
    { id: "bank", name: "Bank Transfer", icon: "account-balance" },
  ]

  return (
    <ScrollView style={styles.container}>
      {/* Search */}
      <Card style={styles.filterCard}>
        <Card.Content>
          <Title style={styles.filterTitle}>Search</Title>
          <TextInput
            label="Search contributions..."
            value={criteria.searchText || ""}
            onChangeText={(text) => setCriteria((prev) => ({ ...prev, searchText: text }))}
            mode="outlined"
            style={styles.searchInput}
            left={<TextInput.Icon icon="search" />}
            right={
              criteria.searchText ? (
                <TextInput.Icon icon="close" onPress={() => setCriteria((prev) => ({ ...prev, searchText: "" }))} />
              ) : null
            }
          />
        </Card.Content>
      </Card>

      {/* Categories */}
      <Card style={styles.filterCard}>
        <Card.Content>
          <Title style={styles.filterTitle}>Categories</Title>
          <View style={styles.chipContainer}>
            {categories.map((category) => (
              <Chip
                key={category.id}
                selected={criteria.categories?.includes(category.id)}
                onPress={() => handleCategoryToggle(category.id)}
                style={[
                  styles.filterChip,
                  criteria.categories?.includes(category.id) && {
                    backgroundColor: category.color + "20",
                  },
                ]}
                textStyle={
                  criteria.categories?.includes(category.id) && {
                    color: category.color,
                  }
                }
              >
                {category.name}
              </Chip>
            ))}
          </View>
        </Card.Content>
      </Card>

      {/* Tags */}
      <Card style={styles.filterCard}>
        <Card.Content>
          <Title style={styles.filterTitle}>Tags</Title>
          <View style={styles.chipContainer}>
            {tags.slice(0, 15).map((tag) => (
              <Chip
                key={tag.id}
                selected={criteria.tags?.includes(tag.id)}
                onPress={() => handleTagToggle(tag.id)}
                style={[
                  styles.filterChip,
                  criteria.tags?.includes(tag.id) && {
                    backgroundColor: tag.color + "20",
                  },
                ]}
                textStyle={
                  criteria.tags?.includes(tag.id) && {
                    color: tag.color,
                  }
                }
              >
                {tag.name}
              </Chip>
            ))}
          </View>
        </Card.Content>
      </Card>

      {/* Platforms */}
      <Card style={styles.filterCard}>
        <Card.Content>
          <Title style={styles.filterTitle}>Platforms</Title>
          <View style={styles.chipContainer}>
            {platforms.map((platform) => (
              <Chip
                key={platform.id}
                selected={criteria.platforms?.includes(platform.id)}
                onPress={() => handlePlatformToggle(platform.id)}
                style={styles.filterChip}
                icon={platform.icon}
              >
                {platform.name}
              </Chip>
            ))}
          </View>
        </Card.Content>
      </Card>

      {/* Members */}
      <Card style={styles.filterCard}>
        <Card.Content>
          <Title style={styles.filterTitle}>Members</Title>
          <View style={styles.chipContainer}>
            {members.slice(0, 10).map((member) => (
              <Chip
                key={member.id}
                selected={criteria.members?.includes(member.id)}
                onPress={() => handleMemberToggle(member.id)}
                style={styles.filterChip}
                icon="person"
              >
                {member.name}
              </Chip>
            ))}
          </View>
          {members.length > 10 && <Text style={styles.moreText}>+{members.length - 10} more members available</Text>}
        </Card.Content>
      </Card>

      {/* Date Range */}
      <Card style={styles.filterCard}>
        <Card.Content>
          <Title style={styles.filterTitle}>Date Range</Title>
          <View style={styles.dateRangeContainer}>
            <View style={styles.dateButton}>
              <Text style={styles.dateLabel}>From</Text>
              <Button mode="outlined" onPress={() => setShowDatePicker("start")} style={styles.datePickerButton}>
                {criteria.dateRange?.start.toLocaleDateString() || "Select Date"}
              </Button>
            </View>
            <View style={styles.dateButton}>
              <Text style={styles.dateLabel}>To</Text>
              <Button mode="outlined" onPress={() => setShowDatePicker("end")} style={styles.datePickerButton}>
                {criteria.dateRange?.end.toLocaleDateString() || "Select Date"}
              </Button>
            </View>
          </View>
        </Card.Content>
      </Card>

      {/* Amount Range */}
      <Card style={styles.filterCard}>
        <Card.Content>
          <Title style={styles.filterTitle}>Amount Range</Title>
          <View style={styles.amountRangeContainer}>
            <Text style={styles.amountRangeText}>
              ${amountRange[0]} - ${amountRange[1]}
            </Text>
            <MultiSlider
              values={amountRange}
              onValuesChange={handleAmountRangeChange}
              min={0}
              max={10000}
              step={50}
              allowOverlap={false}
              snapped
              style={styles.slider}
            />
          </View>
        </Card.Content>
      </Card>

      {/* Sorting */}
      <Card style={styles.filterCard}>
        <Card.Content>
          <Title style={styles.filterTitle}>Sorting</Title>

          <View style={styles.sortingContainer}>
            <View style={styles.pickerContainer}>
              <Text style={styles.pickerLabel}>Sort By</Text>
              <Picker
                selectedValue={criteria.sortBy}
                onValueChange={(value) => setCriteria((prev) => ({ ...prev, sortBy: value as any }))}
                style={styles.picker}
              >
                <Picker.Item label="Date" value="date" />
                <Picker.Item label="Amount" value="amount" />
                <Picker.Item label="Member" value="member" />
                <Picker.Item label="Category" value="category" />
              </Picker>
            </View>

            <View style={styles.sortOrderContainer}>
              <Text style={styles.sortOrderLabel}>Order</Text>
              <View style={styles.sortOrderButtons}>
                <Button
                  mode={criteria.sortOrder === "asc" ? "contained" : "outlined"}
                  onPress={() => setCriteria((prev) => ({ ...prev, sortOrder: "asc" }))}
                  compact
                  style={styles.sortOrderButton}
                >
                  Ascending
                </Button>
                <Button
                  mode={criteria.sortOrder === "desc" ? "contained" : "outlined"}
                  onPress={() => setCriteria((prev) => ({ ...prev, sortOrder: "desc" }))}
                  compact
                  style={styles.sortOrderButton}
                >
                  Descending
                </Button>
              </View>
            </View>
          </View>
        </Card.Content>
      </Card>

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        <Button mode="outlined" onPress={handleClearFilter} style={styles.actionButton} icon="clear">
          Clear All
        </Button>
        <Button mode="contained" onPress={handleApplyFilter} style={styles.actionButton} icon="filter">
          Apply Filter
        </Button>
      </View>

      {/* Date Picker */}
      {showDatePicker && (
        <DateTimePicker
          value={criteria.dateRange?.[showDatePicker] || new Date()}
          mode="date"
          display="default"
          onChange={(event, selectedDate) => {
            if (selectedDate) {
              handleDateChange(showDatePicker, selectedDate)
            } else {
              setShowDatePicker(null)
            }
          }}
        />
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
  },
  filterCard: {
    marginBottom: 15,
    elevation: 2,
  },
  filterTitle: {
    fontSize: 16,
    marginBottom: 15,
    color: "#2E7D32",
  },
  searchInput: {
    marginBottom: 10,
  },
  chipContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  filterChip: {
    marginBottom: 5,
  },
  moreText: {
    fontSize: 12,
    color: "#666",
    marginTop: 10,
    textAlign: "center",
  },
  dateRangeContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  dateButton: {
    flex: 1,
    marginHorizontal: 5,
  },
  dateLabel: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 5,
    color: "#666",
  },
  datePickerButton: {
    justifyContent: "flex-start",
  },
  amountRangeContainer: {
    alignItems: "center",
  },
  amountRangeText: {
    fontSize: 16,
    fontWeight: "500",
    marginBottom: 20,
    color: "#2E7D32",
  },
  slider: {
    width: "100%",
    height: 40,
  },
  sortingContainer: {
    gap: 15,
  },
  pickerContainer: {
    marginBottom: 15,
  },
  pickerLabel: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 5,
    color: "#666",
  },
  picker: {
    backgroundColor: "#F8F8F8",
    borderRadius: 4,
  },
  sortOrderContainer: {
    marginBottom: 10,
  },
  sortOrderLabel: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 10,
    color: "#666",
  },
  sortOrderButtons: {
    flexDirection: "row",
    gap: 10,
  },
  sortOrderButton: {
    flex: 1,
  },
  actionButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
    marginBottom: 40,
  },
  actionButton: {
    flex: 1,
    marginHorizontal: 5,
  },
})

export default AdvancedFilter
