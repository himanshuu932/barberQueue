// FileName: DangerZone.js
import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Modal } from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";

const DangerZone = ({ shopName, onDelete }) => {
  const [isDeleteShopConfirmModalVisible, setIsDeleteShopConfirmModalVisible] = useState(false);

  const handleDelete = () => {
      setIsDeleteShopConfirmModalVisible(false);
      onDelete();
  }

  return (
    <>
      <View style={[styles.card, styles.dangerCard]}>
        <Text style={[styles.cardTitle, { color: '#DC3545' }]}>
          Permanent Deletion
        </Text>
        <Text style={styles.dangerNoteText}>
          Warning: Clicking the button below will permanently delete this shop and all associated data. This action cannot be undone.
        </Text>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => setIsDeleteShopConfirmModalVisible(true)}
        >
          <Icon name="trash" size={16} color="#fff" />
          <Text style={styles.deleteButtonText}>Delete Shop</Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={isDeleteShopConfirmModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsDeleteShopConfirmModalVisible(false)}
      >
        <View style={styles.confirmModalContainer}>
          <View style={styles.confirmModalContent}>
            <Text style={styles.confirmModalTitle}>Delete Shop</Text>
            <Text style={styles.confirmModalText}>
              Are you sure you want to permanently delete "{shopName}"? This action cannot be undone.
            </Text>
            <View style={styles.modalButtonContainer}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalDeleteButton]}
                onPress={handleDelete}
              >
                <Text style={styles.modalButtonText}>Delete</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setIsDeleteShopConfirmModalVisible(false)}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 15,
        padding: 10,
        marginBottom: 15,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 5,
        paddingHorizontal: 15,
        paddingVertical: 20
    },
    cardTitle: {
        fontSize: 22,
        fontWeight: '700',
    },
    dangerCard: {
        borderLeftWidth: 6,
        borderLeftColor: '#E74C3C',
    },
    dangerNoteText: {
        fontSize: 15,
        color: '#666',
        textAlign: 'center',
        marginVertical: 20,
        lineHeight: 22,
    },
    deleteButton: {
        flexDirection: 'row',
        backgroundColor: '#E74C3C',
        padding: 15,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#E74C3C',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.4,
        shadowRadius: 5,
        elevation: 5,
    },
    deleteButtonText: {
        color: '#fff',
        fontSize: 17,
        fontWeight: 'bold',
        marginLeft: 10,
    },
    confirmModalContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.6)',
    },
    confirmModalContent: {
        backgroundColor: '#FFFFFF',
        padding: 20,
        borderRadius: 20,
        width: '85%',
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 15,
        elevation: 15,
    },
    confirmModalTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        marginBottom: 18,
        color: '#333',
    },
    confirmModalText: {
        fontSize: 16,
        color: '#555',
        textAlign: 'center',
        marginBottom: 30,
        lineHeight: 24,
    },
    modalButtonContainer: {
        flexDirection: "row",
        justifyContent: "space-around",
        width: "100%",
        marginTop: 10,
    },
    modalButton: {
        paddingVertical: 15,
        paddingHorizontal: 15,
        borderRadius: 12,
        alignItems: "center",
        flex: 1,
        marginHorizontal: 8,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.2,
        shadowRadius: 5,
        elevation: 4,
    },
    modalButtonText: {
        color: "#fff",
        fontSize: 17,
        fontWeight: "bold",
        textAlign: 'center',
    },
    modalDeleteButton: {
        backgroundColor: '#E74C3C',
    },
    cancelButton: {
        backgroundColor: "#6C757D",
    },
});

export default DangerZone;