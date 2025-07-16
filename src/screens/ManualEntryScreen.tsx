"use client"

import { useState, useEffect, useRef } from "react"
import { View, StyleSheet, ScrollView, Alert } from "react-native"
import { Card, Title, TextInput, Button, Text, Chip, Portal, Dialog, Switch } from "react-native-paper"
import { Picker } from "@react-native-picker/picker"
import DateTimePicker from "@react-native-community/datetimepicker"
import Icon from "react-native-vector-icons/MaterialIcons"

import { ContributionService, type Contribution } from "../services/ContributionService"
import { MemberService, type Member } from "../services/MemberService"
import MemberLookup from "../components/MemberLookup"
import ContributionPreview from "../components/ContributionPreview"
import ValidationSummary from "../components/ValidationSummary"

interface FormData {
  memberId: string
  memberName: string
  amount: string
  platform: string
  date: Date
  time: string
  transactionId: string
  notes: string
  category: string
  isRecurring: boolean
  recurringFrequency?: "weekly" | "monthly" | "quarterly"
  attachments: string[]
}

interface ValidationError {
  field: string
  message: string
  severity: "error" | "warning"
}

const ManualEntryScreen = ({ navigation }: any) => {
  const [formData, setFormData] = useState<FormData>({
    memberId: "",
    memberName: "",
    amount: "",
    platform: "cash",
    date: new Date(),
    time: new Date().toTimeString().slice(0, 5),
    transactionId: "",
    notes: "",
    category: "general",
    isRecurring: false,
    attachments: [],
  })

  const [members, setMembers] = useState<Member[]>([])
  const [recentContributions, setRecentContributions] = useState<Contribution[]>([])
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([])
  const [suggestions, setSuggestions] = useState<any[]>([])

  const [loading, setLoading] = useState({
    save: false,
    validate: false,
    memberLookup: false,
  })

  const [dialogs, setDialogs] = useState({
    memberLookup: false,
    preview: false,
    dateTime: false,
    duplicate: false,
    quickAdd: false,
  })

  const [duplicateContributions, setDuplicateContributions] = useState<Contribution[]>([])
  const [quickAddPresets, setQuickAddPresets] = useState<any[]>([])

  const amountInputRef = useRef<any>(null)
  const notesInputRef = useRef<any>(null)

  useEffect(() => {
    loadInitialData()
    generateSuggestions()
  }, [])

  useEffect(() => {
    validateForm()
  }, [formData])

  useEffect(() => {
    if (formData.amount && formData.memberId) {
      checkForDuplicates()
    }
  }, [formData.amount, formData.memberId, formData.date])

  const loadInitialData = async () => {
    try {
      const [memberList, recentList, presets] = await Promise.all([
        MemberService.getAllMembers(),
        ContributionService.getRecentContributions(7),
        loadQuickAddPresets(),
      ])

      setMembers(memberList)
      setRecentContributions(recentList)
      setQuickAddPresets(presets)
    } catch (error) {
      console.error("Error loading initial data:", error)
    }
  }

  const loadQuickAddPresets = async () => {
    // Load common contribution amounts and patterns
    const contributions = await ContributionService.getRecentContributions(30)
    const amounts = contributions.map((c) => c.amount)
    const commonAmounts = [...new Set(amounts)].sort((a, b) => b - a).slice(0, 6)

    return commonAmounts.map((amount) => ({
      amount,
      label: `$${amount}`,
      frequency: amounts.filter((a) => a === amount).length,
    }))
  }

  const generateSuggestions = () => {
    const now = new Date()
    const suggestions = [
      {
        type: "time",
        title: "Current Time",
        value: now.toTimeString().slice(0, 5),
        icon: "access-time",
      },
      {
        type: "date",
        title: "Today",
        value: now,
        icon: "today",
      },
      {
        type: "platform",
        title: "Most Used Platform",
        value: getMostUsedPlatform(),
        icon: "payment",
      },
    ]
    setSuggestions(suggestions)
  }

  const getMostUsedPlatform = () => {
    const platformCounts = recentContributions.reduce(
      (acc, c) => {
        acc[c.platform] = (acc[c.platform] || 0) + 1
        return acc
      },
      {} as Record<string, number>,
    )

    return Object.entries(platformCounts).sort(([, a], [, b]) => b - a)[0]?.[0] || "cash"
  }

  const validateForm = async () => {
    setLoading((prev) => ({ ...prev, validate: true }))
    const errors: ValidationError[] = []

    // Required field validation
    if (!formData.memberName.trim()) {
      errors.push({
        field: "memberName",
        message: "Member name is required",
        severity: "error",
      })
    }

    if (!formData.amount || Number.parseFloat(formData.amount) <= 0) {
      errors.push({
        field: "amount",
        message: "Valid amount is required",
        severity: "error",
      })
    }

    // Amount validation
    const amount = Number.parseFloat(formData.amount)
    if (amount > 10000) {
      errors.push({
        field: "amount",
        message: "Large amount - please verify",
        severity: "warning",
      })
    }

    if (amount < 1) {
      errors.push({
        field: "amount",
        message: "Amount seems unusually small",
        severity: "warning",
      })
    }

    // Date validation
    const contributionDate = new Date(formData.date)
    const now = new Date()
    const daysDiff = (now.getTime() - contributionDate.getTime()) / (1000 * 60 * 60 * 24)

    if (contributionDate > now) {
      errors.push({
        field: "date",
        message: "Future dates not allowed",
        severity: "error",
      })
    }

    if (daysDiff > 30) {
      errors.push({
        field: "date",
        message: "Contribution is over 30 days old",
        severity: "warning",
      })
    }

    // Member validation
    if (formData.memberId && !members.find((m) => m.id === formData.memberId)) {
      errors.push({
        field: "memberId",
        message: "Selected member not found",
        severity: "error",
      })
    }

    // Transaction ID validation
    if (formData.transactionId) {
      const existingContribution = recentContributions.find((c) => c.transactionId === formData.transactionId)
      if (existingContribution) {
        errors.push({
          field: "transactionId",
          message: "Transaction ID already exists",
          severity: "error",
        })
      }
    }

    setValidationErrors(errors)
    setLoading((prev) => ({ ...prev, validate: false }))
  }

  const checkForDuplicates = async () => {
    if (!formData.amount || !formData.memberId) return

    const amount = Number.parseFloat(formData.amount)
    const contributionDate = new Date(formData.date)

    // Check for potential duplicates within 24 hours
    const startDate = new Date(contributionDate)
    startDate.setHours(0, 0, 0, 0)
    const endDate = new Date(contributionDate)
    endDate.setHours(23, 59, 59, 999)

    const potentialDuplicates = recentContributions.filter((c) => {
      const cDate = new Date(c.date)
      return (
        c.memberId === formData.memberId && Math.abs(c.amount - amount) < 0.01 && cDate >= startDate && cDate <= endDate
      )
    })

    if (potentialDuplicates.length > 0) {
      setDuplicateContributions(potentialDuplicates)
      setDialogs((prev) => ({ ...prev, duplicate: true }))
    }
  }

  const handleMemberSelect = (member: Member) => {
    setFormData((prev) => ({
      ...prev,
      memberId: member.id,
      memberName: member.name,
    }))
    setDialogs((prev) => ({ ...prev, memberLookup: false }))

    // Auto-focus amount field after member selection
    setTimeout(() => {
      amountInputRef.current?.focus()
    }, 100)
  }

  const handleQuickAmount = (amount: number) => {
    setFormData((prev) => ({ ...prev, amount: amount.toString() }))
  }

  const handleSuggestionApply = (suggestion: any) => {
    switch (suggestion.type) {
      case "time":
        setFormData((prev) => ({ ...prev, time: suggestion.value }))
        break
      case "date":
        setFormData((prev) => ({ ...prev, date: suggestion.value }))
        break
      case "platform":
        setFormData((prev) => ({ ...prev, platform: suggestion.value }))
        break
    }
  }

  const handleSave = async () => {
    // Final validation
    const hasErrors = validationErrors.some((e) => e.severity === "error")
    if (hasErrors) {
      Alert.alert("Validation Error", "Please fix all errors before saving")
      return
    }

    setLoading((prev) => ({ ...prev, save: true }))

    try {
      const contribution: Omit<Contribution, "id"> = {
        memberId: formData.memberId,
        memberName: formData.memberName,
        amount: Number.parseFloat(formData.amount),
        platform: formData.platform,
        date: formData.date.toISOString(),
        source: "manual",
        transactionId: formData.transactionId || `manual_${Date.now()}`,
        notes: formData.notes,
        category: formData.category,
        isRecurring: formData.isRecurring,
        recurringFrequency: formData.recurringFrequency,
      }

      await ContributionService.addContribution(contribution)

      // If member doesn't exist, create them
      if (!formData.memberId && formData.memberName) {
        await MemberService.createMember({
          name: formData.memberName,
          phone: "",
          email: "",
          joinDate: new Date().toISOString(),
        })
      }

      Alert.alert("Success", "Contribution added successfully!", [
        {
          text: "Add Another",
          onPress: resetForm,
        },
        {
          text: "Done",
          onPress: () => navigation.goBack(),
        },
      ])
    } catch (error) {
      console.error("Error saving contribution:", error)
      Alert.alert("Error", "Failed to save contribution. Please try again.")
    } finally {
      setLoading((prev) => ({ ...prev, save: false }))
    }
  }

  const resetForm = () => {
    setFormData({
      memberId: "",
      memberName: "",
      amount: "",
      platform: "cash",
      date: new Date(),
      time: new Date().toTimeString().slice(0, 5),
      transactionId: "",
      notes: "",
      category: "general",
      isRecurring: false,
      attachments: [],
    })
    setValidationErrors([])
    setDuplicateContributions([])
  }

  const openDialog = (dialog: keyof typeof dialogs) => {
    setDialogs((prev) => ({ ...prev, [dialog]: true }))
  }

  const closeDialog = (dialog: keyof typeof dialogs) => {
    setDialogs((prev) => ({ ...prev, [dialog]: false }))
  }

  const hasErrors = validationErrors.some((e) => e.severity === "error")
  const hasWarnings = validationErrors.some((e) => e.severity === "warning")

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Title style={styles.header}>Manual Entry</Title>

        {/* Validation Summary */}
        {(hasErrors || hasWarnings) && <ValidationSummary errors={validationErrors} style={styles.validationSummary} />}

        {/* Quick Add Presets */}
        {quickAddPresets.length > 0 && (
          <Card style={styles.quickAddCard}>
            <Card.Content>
              <Text style={styles.cardTitle}>Quick Add</Text>
              <View style={styles.quickAddContainer}>
                {quickAddPresets.map((preset, index) => (
                  <Chip
                    key={index}
                    onPress={() => handleQuickAmount(preset.amount)}
                    style={styles.quickAddChip}
                    icon="attach-money"
                  >
                    {preset.label}
                  </Chip>
                ))}
              </View>
            </Card.Content>
          </Card>
        )}

        {/* Member Selection */}
        <Card style={styles.memberCard}>
          <Card.Content>
            <View style={styles.memberHeader}>
              <Text style={styles.cardTitle}>Member Information</Text>
              <Button mode="outlined" onPress={() => openDialog("memberLookup")} icon="search" compact>
                Lookup
              </Button>
            </View>

            <TextInput
              label="Member Name *"
              value={formData.memberName}
              onChangeText={(text) => setFormData((prev) => ({ ...prev, memberName: text }))}
              mode="outlined"
              style={styles.input}
              error={validationErrors.some((e) => e.field === "memberName" && e.severity === "error")}
              right={formData.memberId ? <TextInput.Icon icon="check-circle" iconColor="#4CAF50" /> : null}
            />

            {formData.memberId && (
              <View style={styles.memberInfo}>
                <Icon name="person" size={16} color="#4CAF50" />
                <Text style={styles.memberInfoText}>Existing member selected</Text>
              </View>
            )}
          </Card.Content>
        </Card>

        {/* Amount and Platform */}
        <Card style={styles.amountCard}>
          <Card.Content>
            <Text style={styles.cardTitle}>Contribution Details</Text>

            <TextInput
              ref={amountInputRef}
              label="Amount *"
              value={formData.amount}
              onChangeText={(text) => setFormData((prev) => ({ ...prev, amount: text }))}
              mode="outlined"
              style={styles.input}
              keyboardType="decimal-pad"
              error={validationErrors.some((e) => e.field === "amount" && e.severity === "error")}
              left={<TextInput.Icon icon="attach-money" />}
            />

            <View style={styles.pickerContainer}>
              <Text style={styles.pickerLabel}>Platform</Text>
              <Picker
                selectedValue={formData.platform}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, platform: value }))}
                style={styles.picker}
              >
                <Picker.Item label="Cash" value="cash" />
                <Picker.Item label="Zelle" value="zelle" />
                <Picker.Item label="Venmo" value="venmo" />
                <Picker.Item label="Cash App" value="cashapp" />
                <Picker.Item label="M-PESA" value="mpesa" />
                <Picker.Item label="Bank Transfer" value="bank" />
                <Picker.Item label="Check" value="check" />
                <Picker.Item label="Other" value="other" />
              </Picker>
            </View>

            <View style={styles.pickerContainer}>
              <Text style={styles.pickerLabel}>Category</Text>
              <Picker
                selectedValue={formData.category}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, category: value }))}
                style={styles.picker}
              >
                <Picker.Item label="General Contribution" value="general" />
                <Picker.Item label="Monthly Dues" value="dues" />
                <Picker.Item label="Special Event" value="event" />
                <Picker.Item label="Emergency Fund" value="emergency" />
                <Picker.Item label="Project Funding" value="project" />
                <Picker.Item label="Other" value="other" />
              </Picker>
            </View>
          </Card.Content>
        </Card>

        {/* Date and Time */}
        <Card style={styles.dateTimeCard}>
          <Card.Content>
            <Text style={styles.cardTitle}>Date & Time</Text>

            <View style={styles.dateTimeRow}>
              <View style={styles.dateContainer}>
                <Text style={styles.dateLabel}>Date</Text>
                <Button mode="outlined" onPress={() => openDialog("dateTime")} style={styles.dateButton}>
                  {formData.date.toLocaleDateString()}
                </Button>
              </View>

              <View style={styles.timeContainer}>
                <Text style={styles.dateLabel}>Time</Text>
                <TextInput
                  value={formData.time}
                  onChangeText={(text) => setFormData((prev) => ({ ...prev, time: text }))}
                  mode="outlined"
                  style={styles.timeInput}
                  placeholder="HH:MM"
                />
              </View>
            </View>

            {/* Smart Suggestions */}
            <View style={styles.suggestionsContainer}>
              <Text style={styles.suggestionsLabel}>Quick Options:</Text>
              <View style={styles.suggestionsRow}>
                {suggestions.map((suggestion, index) => (
                  <Chip
                    key={index}
                    onPress={() => handleSuggestionApply(suggestion)}
                    style={styles.suggestionChip}
                    icon={suggestion.icon}
                  >
                    {suggestion.title}
                  </Chip>
                ))}
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Additional Information */}
        <Card style={styles.additionalCard}>
          <Card.Content>
            <Text style={styles.cardTitle}>Additional Information</Text>

            <TextInput
              label="Transaction ID (Optional)"
              value={formData.transactionId}
              onChangeText={(text) => setFormData((prev) => ({ ...prev, transactionId: text }))}
              mode="outlined"
              style={styles.input}
              error={validationErrors.some((e) => e.field === "transactionId" && e.severity === "error")}
            />

            <TextInput
              ref={notesInputRef}
              label="Notes (Optional)"
              value={formData.notes}
              onChangeText={(text) => setFormData((prev) => ({ ...prev, notes: text }))}
              mode="outlined"
              style={styles.input}
              multiline
              numberOfLines={3}
            />

            <View style={styles.recurringContainer}>
              <View style={styles.recurringHeader}>
                <Text style={styles.recurringLabel}>Recurring Contribution</Text>
                <Switch
                  value={formData.isRecurring}
                  onValueChange={(value) => setFormData((prev) => ({ ...prev, isRecurring: value }))}
                />
              </View>

              {formData.isRecurring && (
                <View style={styles.pickerContainer}>
                  <Text style={styles.pickerLabel}>Frequency</Text>
                  <Picker
                    selectedValue={formData.recurringFrequency}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, recurringFrequency: value as any }))}
                    style={styles.picker}
                  >
                    <Picker.Item label="Weekly" value="weekly" />
                    <Picker.Item label="Monthly" value="monthly" />
                    <Picker.Item label="Quarterly" value="quarterly" />
                  </Picker>
                </View>
              )}
            </View>
          </Card.Content>
        </Card>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <Button
            mode="outlined"
            onPress={() => openDialog("preview")}
            style={styles.actionButton}
            icon="preview"
            disabled={hasErrors}
          >
            Preview
          </Button>

          <Button
            mode="contained"
            onPress={handleSave}
            style={styles.actionButton}
            loading={loading.save}
            disabled={hasErrors}
            icon="save"
          >
            Save Contribution
          </Button>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Dialogs */}
      <Portal>
        {/* Member Lookup Dialog */}
        <Dialog visible={dialogs.memberLookup} onDismiss={() => closeDialog("memberLookup")} style={styles.dialog}>
          <Dialog.Title>Select Member</Dialog.Title>
          <Dialog.ScrollArea>
            <MemberLookup
              members={members}
              onSelect={handleMemberSelect}
              onCreateNew={(name) => {
                setFormData((prev) => ({ ...prev, memberName: name, memberId: "" }))
                closeDialog("memberLookup")
              }}
            />
          </Dialog.ScrollArea>
        </Dialog>

        {/* Preview Dialog */}
        <Dialog visible={dialogs.preview} onDismiss={() => closeDialog("preview")} style={styles.dialog}>
          <Dialog.Title>Contribution Preview</Dialog.Title>
          <Dialog.ScrollArea>
            <ContributionPreview formData={formData} validationErrors={validationErrors} />
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => closeDialog("preview")}>Close</Button>
            <Button
              mode="contained"
              onPress={() => {
                closeDialog("preview")
                handleSave()
              }}
              disabled={hasErrors}
            >
              Save
            </Button>
          </Dialog.Actions>
        </Dialog>

        {/* Date Time Picker */}
        {dialogs.dateTime && (
          <DateTimePicker
            value={formData.date}
            mode="date"
            display="default"
            onChange={(event, selectedDate) => {
              closeDialog("dateTime")
              if (selectedDate) {
                setFormData((prev) => ({ ...prev, date: selectedDate }))
              }
            }}
          />
        )}

        {/* Duplicate Warning Dialog */}
        <Dialog visible={dialogs.duplicate} onDismiss={() => closeDialog("duplicate")} style={styles.dialog}>
          <Dialog.Title>Potential Duplicate</Dialog.Title>
          <Dialog.Content>
            <Text style={styles.duplicateWarning}>Found similar contributions for this member:</Text>
            {duplicateContributions.map((contribution, index) => (
              <View key={index} style={styles.duplicateItem}>
                <Text style={styles.duplicateAmount}>${contribution.amount}</Text>
                <Text style={styles.duplicateDate}>{new Date(contribution.date).toLocaleDateString()}</Text>
                <Text style={styles.duplicatePlatform}>{contribution.platform}</Text>
              </View>
            ))}
            <Text style={styles.duplicateQuestion}>Do you want to continue adding this contribution?</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => closeDialog("duplicate")}>Cancel</Button>
            <Button
              mode="contained"
              onPress={() => {
                closeDialog("duplicate")
                handleSave()
              }}
            >
              Continue
            </Button>
          </Dialog.Actions>
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
  header: {
    fontSize: 24,
    fontWeight: "bold",
    margin: 20,
    marginBottom: 10,
    color: "#2E7D32",
  },
  validationSummary: {
    marginHorizontal: 20,
    marginBottom: 15,
  },
  quickAddCard: {
    marginHorizontal: 20,
    marginBottom: 15,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "500",
    marginBottom: 15,
    color: "#2E7D32",
  },
  quickAddContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  quickAddChip: {
    backgroundColor: "#E8F5E8",
  },
  memberCard: {
    marginHorizontal: 20,
    marginBottom: 15,
    elevation: 2,
  },
  memberHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  memberInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 5,
  },
  memberInfoText: {
    marginLeft: 5,
    fontSize: 12,
    color: "#4CAF50",
  },
  amountCard: {
    marginHorizontal: 20,
    marginBottom: 15,
    elevation: 2,
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
    backgroundColor: "#F8F8F8",
    borderRadius: 4,
  },
  dateTimeCard: {
    marginHorizontal: 20,
    marginBottom: 15,
    elevation: 2,
  },
  dateTimeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 15,
  },
  dateContainer: {
    flex: 1,
    marginRight: 10,
  },
  timeContainer: {
    flex: 1,
    marginLeft: 10,
  },
  dateLabel: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 5,
    color: "#666",
  },
  dateButton: {
    justifyContent: "flex-start",
  },
  timeInput: {
    height: 40,
  },
  suggestionsContainer: {
    marginTop: 10,
  },
  suggestionsLabel: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 8,
    color: "#666",
  },
  suggestionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  suggestionChip: {
    backgroundColor: "#E3F2FD",
  },
  additionalCard: {
    marginHorizontal: 20,
    marginBottom: 15,
    elevation: 2,
  },
  recurringContainer: {
    marginTop: 10,
  },
  recurringHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  recurringLabel: {
    fontSize: 16,
    fontWeight: "500",
  },
  actionButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginTop: 10,
  },
  actionButton: {
    flex: 1,
    marginHorizontal: 5,
  },
  bottomSpacer: {
    height: 50,
  },
  dialog: {
    maxHeight: "80%",
  },
  duplicateWarning: {
    fontSize: 14,
    marginBottom: 15,
    color: "#666",
  },
  duplicateItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#FFF3E0",
    borderRadius: 4,
    marginBottom: 8,
  },
  duplicateAmount: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#F57C00",
  },
  duplicateDate: {
    fontSize: 14,
    color: "#666",
  },
  duplicatePlatform: {
    fontSize: 12,
    color: "#666",
    textTransform: "capitalize",
  },
  duplicateQuestion: {
    fontSize: 14,
    marginTop: 15,
    fontWeight: "500",
  },
})

export default ManualEntryScreen
