// FileName: DangerZone.js
import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Modal, Dimensions  } from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

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
          <Icon name="trash" size={screenWidth * 0.05} color="#fff" />
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
        borderRadius: screenWidth * 0.04,
        padding: screenWidth * 0.03,
        marginBottom: screenHeight * 0.02,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: screenHeight * 0.004 },
        shadowOpacity: 0.08,
        shadowRadius: screenWidth * 0.02,
        elevation: 5,
        paddingHorizontal: screenWidth * 0.04,
        paddingVertical: screenHeight * 0.025
    },
    cardTitle: {
        fontSize: screenWidth * 0.055,
        fontWeight: '700',
    },
    dangerCard: {
        borderLeftWidth: screenWidth * 0.015,
        borderLeftColor: '#E74C3C',
    },
    dangerNoteText: {
        fontSize: screenWidth * 0.038,
        color: '#666',
        textAlign: 'center',
        marginVertical: screenHeight * 0.025,
        lineHeight: screenHeight * 0.03,
    },
    deleteButton: {
        flexDirection: 'row',
        backgroundColor: '#E74C3C',
        padding: screenHeight * 0.02,
        borderRadius: screenWidth * 0.03,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#E74C3C',
        shadowOffset: { width: 0, height: screenHeight * 0.003 },
        shadowOpacity: 0.4,
        shadowRadius: screenWidth * 0.01,
        elevation: 5,
    },
    deleteButtonText: {
        color: '#fff',
        fontSize: screenWidth * 0.04,
        fontWeight: 'bold',
        marginLeft: screenWidth * 0.02,
    },
    confirmModalContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.6)',
    },
    confirmModalContent: {
        backgroundColor: '#FFFFFF',
        padding: screenWidth * 0.05,
        borderRadius: screenWidth * 0.05,
        width: '85%',
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: screenHeight * 0.008 },
        shadowOpacity: 0.25,
        shadowRadius: screenWidth * 0.04,
        elevation: 15,
    },
    confirmModalTitle: {
        fontSize: screenWidth * 0.055,
        fontWeight: 'bold',
        marginBottom: screenHeight * 0.02,
        color: '#333',
    },
    confirmModalText: {
        fontSize: screenWidth * 0.04,
        color: '#555',
        textAlign: 'center',
        marginBottom: screenHeight * 0.035,
        lineHeight: screenHeight * 0.03,
    },
    modalButtonContainer: {
        flexDirection: "row",
        justifyContent: "space-around",
        width: "100%",
        marginTop: screenHeight * 0.015,
    },
    modalButton: {
        paddingVertical: screenHeight * 0.018,
        paddingHorizontal: screenWidth * 0.04,
        borderRadius: screenWidth * 0.03,
        alignItems: "center",
        flex: 1,
        marginHorizontal: screenWidth * 0.02,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: screenHeight * 0.003 },
        shadowOpacity: 0.2,
        shadowRadius: screenWidth * 0.01,
        elevation: 4,
    },
    modalButtonText: {
        color: "#fff",
        fontSize: screenWidth * 0.04,
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