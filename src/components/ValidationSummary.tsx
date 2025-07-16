import type React from "react"
import { View, StyleSheet } from "react-native"
import { Card, Text, Chip } from "react-native-paper"
import Icon from "react-native-vector-icons/MaterialIcons"

interface ValidationError {
  field: string
  message: string
  severity: "error" | "warning"
}

interface ValidationSummaryProps {
  errors: ValidationError[]
  style?: any
}

const ValidationSummary: React.FC<ValidationSummaryProps> = ({ errors, style }) => {
  const errorCount = errors.filter((e) => e.severity === "error").length
  const warningCount = errors.filter((e) => e.severity === "warning").length

  if (errors.length === 0) return null

  return (
    <Card style={[styles.container, style]}>
      <Card.Content>
        <View style={styles.header}>
          <Icon name={errorCount > 0 ? "error" : "warning"} size={20} color={errorCount > 0 ? "#D32F2F" : "#F57C00"} />
          <Text style={styles.title}>Validation Summary</Text>
          <View style={styles.counts}>
            {errorCount > 0 && (
              <Chip style={styles.errorChip} textStyle={styles.errorChipText} icon="error">
                {errorCount} Error{errorCount !== 1 ? "s" : ""}
              </Chip>
            )}
            {warningCount > 0 && (
              <Chip style={styles.warningChip} textStyle={styles.warningChipText} icon="warning">
                {warningCount} Warning{warningCount !== 1 ? "s" : ""}
              </Chip>
            )}
          </View>
        </View>

        <View style={styles.errorsList}>
          {errors.map((error, index) => (
            <View key={index} style={styles.errorItem}>
              <Icon
                name={error.severity === "error" ? "error" : "warning"}
                size={16}
                color={error.severity === "error" ? "#D32F2F" : "#F57C00"}
              />
              <Text style={[styles.errorText, { color: error.severity === "error" ? "#D32F2F" : "#F57C00" }]}>
                {error.message}
              </Text>
            </View>
          ))}
        </View>
      </Card.Content>
    </Card>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#FFF3E0",
    borderLeftWidth: 4,
    borderLeftColor: "#F57C00",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: "500",
    marginLeft: 8,
    flex: 1,
    color: "#333",
  },
  counts: {
    flexDirection: "row",
    gap: 8,
  },
  errorChip: {
    backgroundColor: "#FFEBEE",
    height: 24,
  },
  errorChipText: {
    fontSize: 12,
    color: "#D32F2F",
  },
  warningChip: {
    backgroundColor: "#FFF8E1",
    height: 24,
  },
  warningChipText: {
    fontSize: 12,
    color: "#F57C00",
  },
  errorsList: {
    gap: 8,
  },
  errorItem: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  errorText: {
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
    lineHeight: 20,
  },
})

export default ValidationSummary
