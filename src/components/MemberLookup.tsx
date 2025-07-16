"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { View, StyleSheet, FlatList } from "react-native"
import { TextInput, List, Button, Text, Chip, Card, Divider } from "react-native-paper"
import Icon from "react-native-vector-icons/MaterialIcons"

import type { Member } from "../services/MemberService"

interface MemberLookupProps {
  members: Member[]
  onSelect: (member: Member) => void
  onCreateNew: (name: string) => void
}

const MemberLookup: React.FC<MemberLookupProps> = ({ members, onSelect, onCreateNew }) => {
  const [searchQuery, setSearchQuery] = useState("")
  const [filteredMembers, setFilteredMembers] = useState<Member[]>([])
  const [recentMembers, setRecentMembers] = useState<Member[]>([])

  useEffect(() => {
    // Get recent members (those with contributions in last 30 days)
    const recent = members
      .filter((member) => member.lastContribution)
      .sort((a, b) => new Date(b.lastContribution!).getTime() - new Date(a.lastContribution!).getTime())
      .slice(0, 5)

    setRecentMembers(recent)
    setFilteredMembers(searchQuery ? filterMembers(searchQuery) : recent)
  }, [members, searchQuery])

  const filterMembers = (query: string) => {
    const lowercaseQuery = query.toLowerCase()
    return members
      .filter(
        (member) =>
          member.name.toLowerCase().includes(lowercaseQuery) ||
          member.phone?.toLowerCase().includes(lowercaseQuery) ||
          member.email?.toLowerCase().includes(lowercaseQuery),
      )
      .slice(0, 20) // Limit results
  }

  const handleCreateNew = () => {
    if (searchQuery.trim()) {
      onCreateNew(searchQuery.trim())
    }
  }

  const renderMemberItem = ({ item }: { item: Member }) => (
    <List.Item
      title={item.name}
      description={`${item.phone || "No phone"} • ${item.totalContributions || 0} contributions`}
      left={() => (
        <View style={styles.memberAvatar}>
          <Icon name="person" size={24} color="#2E7D32" />
        </View>
      )}
      right={() => (
        <View style={styles.memberStats}>
          {item.totalAmount && <Text style={styles.totalAmount}>${item.totalAmount}</Text>}
          {item.lastContribution && (
            <Text style={styles.lastContribution}>{new Date(item.lastContribution).toLocaleDateString()}</Text>
          )}
        </View>
      )}
      onPress={() => onSelect(item)}
      style={styles.memberItem}
    />
  )

  return (
    <View style={styles.container}>
      <TextInput
        label="Search members..."
        value={searchQuery}
        onChangeText={setSearchQuery}
        mode="outlined"
        style={styles.searchInput}
        left={<TextInput.Icon icon="search" />}
        right={searchQuery ? <TextInput.Icon icon="close" onPress={() => setSearchQuery("")} /> : null}
      />

      {!searchQuery && recentMembers.length > 0 && (
        <View style={styles.recentSection}>
          <Text style={styles.sectionTitle}>Recent Contributors</Text>
          <View style={styles.recentChips}>
            {recentMembers.map((member) => (
              <Chip key={member.id} onPress={() => onSelect(member)} style={styles.recentChip} icon="person">
                {member.name}
              </Chip>
            ))}
          </View>
        </View>
      )}

      <View style={styles.resultsSection}>
        <Text style={styles.sectionTitle}>
          {searchQuery ? `Search Results (${filteredMembers.length})` : "All Members"}
        </Text>

        {filteredMembers.length === 0 && searchQuery ? (
          <Card style={styles.noResultsCard}>
            <Card.Content style={styles.noResultsContent}>
              <Icon name="person-add" size={48} color="#ccc" />
              <Text style={styles.noResultsText}>No members found</Text>
              <Button mode="contained" onPress={handleCreateNew} style={styles.createButton} icon="person-add">
                Create "{searchQuery}"
              </Button>
            </Card.Content>
          </Card>
        ) : (
          <FlatList
            data={filteredMembers}
            renderItem={renderMemberItem}
            keyExtractor={(item) => item.id}
            style={styles.membersList}
            showsVerticalScrollIndicator={false}
            ItemSeparatorComponent={() => <Divider />}
          />
        )}
      </View>

      {searchQuery && filteredMembers.length > 0 && (
        <View style={styles.createNewSection}>
          <Button mode="outlined" onPress={handleCreateNew} style={styles.createNewButton} icon="person-add">
            Create new member "{searchQuery}"
          </Button>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    maxHeight: 500,
  },
  searchInput: {
    marginBottom: 20,
  },
  recentSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "500",
    marginBottom: 10,
    color: "#2E7D32",
  },
  recentChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  recentChip: {
    backgroundColor: "#E8F5E8",
  },
  resultsSection: {
    flex: 1,
  },
  membersList: {
    maxHeight: 300,
  },
  memberItem: {
    paddingVertical: 8,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#E8F5E8",
    justifyContent: "center",
    alignItems: "center",
  },
  memberStats: {
    alignItems: "flex-end",
  },
  totalAmount: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#2E7D32",
  },
  lastContribution: {
    fontSize: 12,
    color: "#666",
  },
  noResultsCard: {
    marginVertical: 20,
  },
  noResultsContent: {
    alignItems: "center",
    paddingVertical: 20,
  },
  noResultsText: {
    fontSize: 16,
    color: "#666",
    marginVertical: 10,
  },
  createButton: {
    marginTop: 10,
  },
  createNewSection: {
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: "#E0E0E0",
  },
  createNewButton: {
    width: "100%",
  },
})

export default MemberLookup
