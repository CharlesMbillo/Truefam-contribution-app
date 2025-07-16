import type React from "react"
import { View, StyleSheet } from "react-native"
import { Card, Title, Text, Chip, Divider } from "react-native-paper"
import Icon from "react-native-vector-icons/MaterialIcons"

interface ContributionPreviewProps {
  formData: any
  validationErrors: any[]
}

const ContributionPreview: React.FC<ContributionPreviewProps> = ({ formData, validationErrors }) => {
  const getPlatformIcon = (platform: string) => {
    const icons: Record<string, string> = {
      cash: "money",
      zelle: "account-balance",
      venmo: "payment",
      cashapp: "mobile-friendly",
      mpesa: "phone-android",
      bank: "account-balance",
      check: "receipt",
      other: "payment",
    }
    return icons[platform] || "payment"
  }

  const formatAmount = (amount: string) => {
    const num = Number.parseFloat(amount)
    return isNaN(num) ? "$0.00" : `$${num.toFixed(2)}`
  }

  const hasErrors = validationErrors.some((e) => e.severity === "error")
  const hasWarnings = validationErrors.some((e) => e.severity === "warning")

  return (
    <View style={styles.container}>
      <Card style={styles.previewCard}>
        <Card.Content>
          <View style={styles.header}>
            <Icon name="preview" size={24} color="#2E7D32" />
            <Title style={styles.title}>Contribution Summary</Title>
          </View>

          <View style={styles.amountSection}>
            <Text style={styles.amountLabel}>Amount</Text>
            <Text style={styles.amountValue}>{formatAmount(formData.amount)}</Text>
          </View>

          <Divider style={styles.divider} />

          <View style={styles.detailsSection}>
            <View style={styles.detailRow}>
              <Icon name="person" size={20} color="#666" />
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Member</Text>
                <Text style={styles.detailValue}>{formData.memberName || "Not specified"}</Text>
                {formData.memberId && (
                  <Chip style={styles.memberChip} textStyle={styles.memberChipText}>
                    Existing Member
                  </Chip>
                )}
              </View>
            </View>

            <View style={styles.detailRow}>
              <Icon name={getPlatformIcon(formData.platform)} size={20} color="#666" />
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Platform</Text>
                <Text style={styles.detailValue}>
                  {formData.platform.charAt(0).toUpperCase() + formData.platform.slice(1)}
                </Text>
              </View>
            </View>

            <View style={styles.detailRow}>
              <Icon name="event" size={20} color="#666" />
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Date & Time</Text>
                <Text style={styles.detailValue}>
                  {formData.date.toLocaleDateString()} at {formData.time}
                </Text>
              </View>
            </View>

            <View style={styles.detailRow}>
              <Icon name="category" size={20} color="#666" />
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Category</Text>
                <Text style={styles.detailValue}>
                  {formData.category.charAt(0).toUpperCase() + formData.category.slice(1)}
                </Text>
              </View>
            </View>

            {formData.transactionId && (
              <View style={styles.detailRow}>
                <Icon name="receipt" size={20} color="#666" />
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>Transaction ID</Text>
                  <Text style={styles.detailValue}>{formData.transactionId}</Text>
                </View>
              </View>
            )}

            {formData.notes && (
              <View style={styles.detailRow}>
                <Icon name="note" size={20} color="#666" />
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>Notes</Text>
                  <Text style={styles.detailValue}>{formData.notes}</Text>
                </View>
              </View>
            )}

            {formData.isRecurring && (
              <View style={styles.detailRow}>
                <Icon name="repeat" size={20} color="#666" />
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>Recurring</Text>
                  <Text style={styles.detailValue}>
                    {formData.recurringFrequency?.charAt(0).toUpperCase() + formData.recurringFrequency?.slice(1) ||
                      "Yes"}
                  </Text>
                </View>
              </View>
            )}
          </View>

          {(hasErrors || hasWarnings) && (
            <>
              <Divider style={styles.divider} />
              <View style={styles.validationSection}>
                <Text style={styles.validationTitle}>Validation Status</Text>
                {validationErrors.map((error, index) => (
                  <View key={index} style={styles.validationItem}>
                    <Icon
                      name={error.severity === "error" ? "error" : "warning"}
                      size={16}
                      color={error.severity === "error" ? "#D32F2F" : "#F57C00"}
                    />
                    <Text
                      style={[styles.validationText, { color: error.severity === "error" ? "#D32F2F" : "#F57C00" }]}
                    >
                      {error.message}
                    </Text>
                  </View>
                ))}
              </View>
            </>
          )}
        </Card.Content>
      </Card>

      <Card style={styles.statusCard}>
        <Card.Content>
          <View style={styles.statusHeader}>
            <Icon
              name={hasErrors ? "error" : hasWarnings ? "warning" : "check-circle"}
              size={24}
              color={hasErrors ? "#D32F2F" : hasWarnings ? "#F57C00" : "#4CAF50"}
            />
            <Text style={[styles.statusText, { color: hasErrors ? "#D32F2F" : hasWarnings ? "#F57C00" : "#4CAF50" }]}>
              {hasErrors ? "Has Errors" : hasWarnings ? "Has Warnings" : "Ready to Save"}
            </Text>
          </View>
        </Card.Content>
      </Card>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
  },
  previewCard: {
    marginBottom: 15,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    marginLeft: 10,
    color: "#2E7D32",
  },
  amountSection: {
    alignItems: "center",
    marginBottom: 20,
  },
  amountLabel: {
    fontSize: 14,
    color: "#666",
    marginBottom: 5,
  },
  amountValue: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#2E7D32",
  },
  divider: {
    marginVertical: 15,
  },
  detailsSection: {
    gap: 15,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  detailContent: {
    flex: 1,
    marginLeft: 15,
  },
  detailLabel: {
    fontSize: 12,
    color: "#666",
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 16,
    color: "#333",
  },
  memberChip: {
    alignSelf: "flex-start",
    marginTop: 5,
    backgroundColor: "#E8F5E8",
  },
  memberChipText: {
    fontSize: 12,
    color: "#2E7D32",
  },
  validationSection: {
    marginTop: 10,
  },
  validationTitle: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 10,
    color: "#666",
  },
  validationItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 5,
  },
  validationText: {
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
  statusCard: {
    backgroundColor: "#F8F8F8",
  },
  statusHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  statusText: {
    fontSize: 16,
    fontWeight: "500",
    marginLeft: 10,
  },
})

export default ContributionPreview
