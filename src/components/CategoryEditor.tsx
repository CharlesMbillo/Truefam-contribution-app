"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { View, StyleSheet, ScrollView } from "react-native"
import { TextInput, Button, Text, Card, Title, Switch, IconButton } from "react-native-paper"
import { Picker } from "@react-native-picker/picker"
import ColorPicker from "react-native-wheel-color-picker"

import type { Category, CategoryRule } from "../services/CategoryService"

interface CategoryEditorProps {
  category?: Category | null
  onSave: (categoryData: any) => void
  onCancel: () => void
}

const CategoryEditor: React.FC<CategoryEditorProps> = ({ category, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    color: "#4CAF50",
    icon: "category",
    isActive: true,
    parentId: "",
  })

  const [rules, setRules] = useState<CategoryRule[]>([])
  const [showColorPicker, setShowColorPicker] = useState(false)

  useEffect(() => {
    if (category) {
      setFormData({
        name: category.name,
        description: category.description,
        color: category.color,
        icon: category.icon,
        isActive: category.isActive,
        parentId: category.parentId || "",
      })
      setRules(category.rules || [])
    }
  }, [category])

  const addRule = () => {
    const newRule: CategoryRule = {
      id: `rule_${Date.now()}`,
      field: "amount",
      operator: "greater_than",
      value: 0,
      priority: 5,
    }
    setRules([...rules, newRule])
  }

  const updateRule = (index: number, updates: Partial<CategoryRule>) => {
    const newRules = [...rules]
    newRules[index] = { ...newRules[index], ...updates }
    setRules(newRules)
  }

  const removeRule = (index: number) => {
    setRules(rules.filter((_, i) => i !== index))
  }

  const handleSave = () => {
    if (!formData.name.trim()) {
      return
    }

    const categoryData = {
      ...formData,
      rules: rules.length > 0 ? rules : undefined,
    }

    onSave(categoryData)
  }

  const iconOptions = [
    { value: "category", label: "Category" },
    { value: "attach-money", label: "Money" },
    { value: "event", label: "Event" },
    { value: "emergency", label: "Emergency" },
    { value: "celebration", label: "Celebration" },
    { value: "volunteer-activism", label: "Donation" },
    { value: "family-restroom", label: "Family" },
    { value: "school", label: "Education" },
    { value: "local-hospital", label: "Health" },
    { value: "home", label: "Home" },
  ]

  const fieldOptions = [
    { value: "amount", label: "Amount" },
    { value: "platform", label: "Platform" },
    { value: "memberName", label: "Member Name" },
    { value: "notes", label: "Notes" },
    { value: "time", label: "Time of Day" },
    { value: "frequency", label: "Frequency" },
  ]

  const operatorOptions = [
    { value: "equals", label: "Equals" },
    { value: "contains", label: "Contains" },
    { value: "greater_than", label: "Greater Than" },
    { value: "less_than", label: "Less Than" },
    { value: "between", label: "Between" },
    { value: "in_list", label: "In List" },
  ]

  const renderRuleEditor = (rule: CategoryRule, index: number) => (
    <Card key={rule.id} style={styles.ruleCard}>
      <Card.Content>
        <View style={styles.ruleHeader}>
          <Text style={styles.ruleTitle}>Rule {index + 1}</Text>
          <IconButton icon="delete" size={20} onPress={() => removeRule(index)} />
        </View>

        <View style={styles.pickerContainer}>
          <Text style={styles.pickerLabel}>Field</Text>
          <Picker
            selectedValue={rule.field}
            onValueChange={(value) => updateRule(index, { field: value as any })}
            style={styles.picker}
          >
            {fieldOptions.map((option) => (
              <Picker.Item key={option.value} label={option.label} value={option.value} />
            ))}
          </Picker>
        </View>

        <View style={styles.pickerContainer}>
          <Text style={styles.pickerLabel}>Operator</Text>
          <Picker
            selectedValue={rule.operator}
            onValueChange={(value) => updateRule(index, { operator: value as any })}
            style={styles.picker}
          >
            {operatorOptions.map((option) => (
              <Picker.Item key={option.value} label={option.label} value={option.value} />
            ))}
          </Picker>
        </View>

        <TextInput
          label="Value"
          value={rule.value?.toString() || ""}
          onChangeText={(text) => {
            const value = rule.field === "amount" ? Number.parseFloat(text) || 0 : text
            updateRule(index, { value })
          }}
          mode="outlined"
          style={styles.input}
          keyboardType={rule.field === "amount" ? "numeric" : "default"}
        />

        <TextInput
          label="Priority (1-10)"
          value={rule.priority.toString()}
          onChangeText={(text) => {
            const priority = Number.parseInt(text) || 5
            updateRule(index, { priority })
          }}
          mode="outlined"
          style={styles.input}
          keyboardType="numeric"
        />
      </Card.Content>
    </Card>
  )

  return (
    <ScrollView style={styles.container}>
      <Card style={styles.basicInfoCard}>
        <Card.Content>
          <Title style={styles.cardTitle}>Basic Information</Title>

          <TextInput
            label="Category Name"
            value={formData.name}
            onChangeText={(text) => setFormData((prev) => ({ ...prev, name: text }))}
            mode="outlined"
            style={styles.input}
            placeholder="e.g., Monthly Dues"
          />

          <TextInput
            label="Description"
            value={formData.description}
            onChangeText={(text) => setFormData((prev) => ({ ...prev, description: text }))}
            mode="outlined"
            style={styles.input}
            multiline
            numberOfLines={2}
            placeholder="Brief description of this category"
          />

          <View style={styles.pickerContainer}>
            <Text style={styles.pickerLabel}>Icon</Text>
            <Picker
              selectedValue={formData.icon}
              onValueChange={(value) => setFormData((prev) => ({ ...prev, icon: value }))}
              style={styles.picker}
            >
              {iconOptions.map((option) => (
                <Picker.Item key={option.value} label={option.label} value={option.value} />
              ))}
            </Picker>
          </View>

          <View style={styles.colorSection}>
            <Text style={styles.pickerLabel}>Color</Text>
            <View style={styles.colorRow}>
              <View style={[styles.colorPreview, { backgroundColor: formData.color }]} />
              <Button mode="outlined" onPress={() => setShowColorPicker(!showColorPicker)} style={styles.colorButton}>
                {formData.color}
              </Button>
            </View>
          </View>

          {showColorPicker && (
            <View style={styles.colorPickerContainer}>
              <ColorPicker
                color={formData.color}
                onColorChange={(color) => setFormData((prev) => ({ ...prev, color }))}
                thumbSize={30}
                sliderSize={30}
                noSnap={true}
                row={false}
                style={styles.colorPicker}
              />
            </View>
          )}

          <View style={styles.switchContainer}>
            <Text style={styles.switchLabel}>Active</Text>
            <Switch
              value={formData.isActive}
              onValueChange={(isActive) => setFormData((prev) => ({ ...prev, isActive }))}
            />
          </View>
        </Card.Content>
      </Card>

      <Card style={styles.rulesCard}>
        <Card.Content>
          <View style={styles.rulesHeader}>
            <Title style={styles.cardTitle}>Auto-categorization Rules</Title>
            <Button mode="outlined" onPress={addRule} icon="plus" compact>
              Add Rule
            </Button>
          </View>

          <Text style={styles.rulesDescription}>
            Rules help automatically categorize contributions based on their properties. Higher priority rules are
            evaluated first.
          </Text>

          {rules.length === 0 ? (
            <View style={styles.noRulesContainer}>
              <Text style={styles.noRulesText}>
                No rules defined. Contributions will need to be categorized manually.
              </Text>
            </View>
          ) : (
            rules.map((rule, index) => renderRuleEditor(rule, index))
          )}
        </Card.Content>
      </Card>

      <View style={styles.buttonContainer}>
        <Button mode="outlined" onPress={onCancel} style={styles.button}>
          Cancel
        </Button>
        <Button mode="contained" onPress={handleSave} style={styles.button} disabled={!formData.name.trim()}>
          Save Category
        </Button>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
  },
  basicInfoCard: {
    marginBottom: 15,
  },
  rulesCard: {
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
    backgroundColor: "#F5F5F5",
    borderRadius: 4,
  },
  colorSection: {
    marginBottom: 15,
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
  colorPickerContainer: {
    height: 200,
    marginBottom: 15,
  },
  colorPicker: {
    flex: 1,
  },
  switchContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
  },
  switchLabel: {
    fontSize: 16,
  },
  rulesHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  rulesDescription: {
    fontSize: 14,
    color: "#666",
    marginBottom: 15,
    lineHeight: 20,
  },
  noRulesContainer: {
    padding: 20,
    alignItems: "center",
  },
  noRulesText: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    fontStyle: "italic",
  },
  ruleCard: {
    marginBottom: 10,
    backgroundColor: "#F8F8F8",
  },
  ruleHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  ruleTitle: {
    fontSize: 14,
    fontWeight: "500",
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
    marginBottom: 40,
  },
  button: {
    flex: 1,
    marginHorizontal: 5,
  },
})

export default CategoryEditor
