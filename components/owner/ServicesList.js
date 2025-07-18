// FileName: ServicesList.js
import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  Dimensions
} from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");
const API_BASE_URL = 'http://10.0.2.2:5000/api';

const ServicesList = ({ services, shopId, userToken, onServicesUpdate }) => {
    const [isAddServiceModalVisible, setIsAddServiceModalVisible] = useState(false);
    const [newServiceData, setNewServiceData] = useState({ name: '', price: '' });
    
    const [isEditServiceModalVisible, setIsEditServiceModalVisible] = useState(false);
    const [editingService, setEditingService] = useState(null);
    const [editedServiceData, setEditedServiceData] = useState({ name: '', price: '' });
    
    const [isDeleteServiceConfirmModalVisible, setIsDeleteServiceConfirmModalVisible] = useState(false);
    const [serviceToDelete, setServiceToDelete] = useState(null);

    const handleOpenAddServiceModal = () => {
        setNewServiceData({ name: '', price: '' });
        setIsAddServiceModalVisible(true);
    };

    const handleAddService = async () => {
        if (!newServiceData.name || !newServiceData.price) {
            Alert.alert("Validation Error", "Service name and price are required.");
            return;
        }
        const price = parseFloat(newServiceData.price);
        if (isNaN(price) || price < 0) {
            Alert.alert("Validation Error", "Invalid price.");
            return;
        }
        if (!shopId || !userToken) {
            Alert.alert("Error", "Shop or token missing.");
            return;
        }
        try {
            const response = await fetch(`${API_BASE_URL}/shops/${shopId}/services`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userToken}` },
                body: JSON.stringify({ name: newServiceData.name, price: price }),
            });
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.message || 'Failed to add service.');
            }
            Alert.alert("Success", "Service added!");
            setIsAddServiceModalVisible(false);
            await onServicesUpdate();
        } catch (err) {
            console.error('Error adding service:', err);
            Alert.alert("Error", err.message);
        }
    };

    const handleOpenEditServiceModal = (service) => {
        setEditingService(service);
        setEditedServiceData({ name: service.name, price: service.price.toString() });
        setIsEditServiceModalVisible(true);
    };

    const handleUpdateService = async () => {
        if (!editingService || !userToken) {
            Alert.alert("Error", "No service selected or token missing.");
            return;
        }
        if (!editedServiceData.name || !editedServiceData.price) {
            Alert.alert("Validation Error", "Service name and price are required.");
            return;
        }
        const price = parseFloat(editedServiceData.price);
        if (isNaN(price) || price < 0) {
            Alert.alert("Validation Error", "Invalid price.");
            return;
        }
        try {
            const response = await fetch(`${API_BASE_URL}/shops/${shopId}/services/${editingService._id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userToken}` },
                body: JSON.stringify({ name: editedServiceData.name, price: price }),
            });
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.message || 'Failed to update service.');
            }
            Alert.alert("Success", "Service updated!");
            setIsEditServiceModalVisible(false);
            setEditingService(null);
            await onServicesUpdate();
        } catch (err) {
            console.error('Error updating service:', err);
            Alert.alert("Error", err.message);
        }
    };

    const confirmDeleteService = (service) => {
        setServiceToDelete(service);
        setIsDeleteServiceConfirmModalVisible(true);
    };

    const executeDeleteService = async () => {
        if (!serviceToDelete || !shopId || !userToken) {
            Alert.alert("Error", "Service, shop or token missing.");
            return;
        }
        try {
            const response = await fetch(`${API_BASE_URL}/shops/${shopId}/services/${serviceToDelete._id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${userToken}` },
            });
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.message || 'Failed to delete service.');
            }
            Alert.alert("Success", "Service removed!");
            setIsDeleteServiceConfirmModalVisible(false);
            setServiceToDelete(null);
            await onServicesUpdate();
        } catch (err) {
            console.error('Error deleting service:', err);
            Alert.alert("Error", err.message);
        }
    };

    return (
        <View style={styles.card}>
            <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Services</Text>
                <TouchableOpacity
                    style={styles.addButton}
                    onPress={handleOpenAddServiceModal}
                >
                    <Icon name="plus" size={16} color="#fff" />
                </TouchableOpacity>
            </View>

            {services && services.length > 0 ? (
                services.map(service => (
                    <View key={service._id} style={styles.listItem}>
                        <View style={styles.listItemInfo}>
                            <Text style={styles.itemName}>{service.name}</Text>
                            <Text style={styles.itemPrice}>₹{service.price.toFixed(2)}</Text>
                        </View>
                        <View style={styles.listItemActions}>
                            <TouchableOpacity
                                style={styles.listItemActionButton}
                                onPress={() => handleOpenEditServiceModal(service)}
                            >
                                <Icon name="pencil" size={16} color="#007BFF" />
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.listItemActionButton}
                                onPress={() => confirmDeleteService(service)}
                            >
                                <Icon name="trash" size={16} color="#DC3545" />
                            </TouchableOpacity>
                        </View>
                    </View>
                ))
            ) : (
                <Text style={styles.noDataText}>No services listed yet</Text>
            )}

            {/* Add Service Modal */}
            <Modal visible={isAddServiceModalVisible} transparent animationType="slide" onRequestClose={() => setIsAddServiceModalVisible(false)}>
                <View style={styles.modalContainer}>
                    <View style={styles.modalContent}>
                    <Text style={styles.modalTitle}>Add Service</Text>
                    <Text style={styles.inputLabel}>Service Name:</Text>
                    <TextInput style={styles.input} value={newServiceData.name} onChangeText={txt => setNewServiceData({ ...newServiceData, name: txt })} />
                    <Text style={styles.inputLabel}>Price:</Text>
                    <TextInput style={styles.input} value={newServiceData.price} onChangeText={txt => setNewServiceData({ ...newServiceData, price: txt })} keyboardType="numeric" />
                    <View style={styles.modalButtonContainer}>
                        <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setIsAddServiceModalVisible(false)}>
                        <Text style={styles.modalButtonText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.modalButton, styles.saveButton]} onPress={handleAddService}>
                        <Text style={styles.modalButtonText}>Add</Text>
                        </TouchableOpacity>
                    </View>
                    </View>
                </View>
            </Modal>

            {/* Edit Service Modal */}
            <Modal visible={isEditServiceModalVisible} transparent animationType="slide" onRequestClose={() => setIsEditServiceModalVisible(false)}>
                <View style={styles.modalContainer}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Edit Service</Text>
                        {editingService && (
                            <>
                            <Text style={styles.inputLabel}>Service Name:</Text>
                            <TextInput style={styles.input} value={editedServiceData.name} onChangeText={txt => setEditedServiceData({ ...editedServiceData, name: txt })} />
                            <Text style={styles.inputLabel}>Price:</Text>
                            <TextInput style={styles.input} value={editedServiceData.price} onChangeText={txt => setEditedServiceData({ ...editedServiceData, price: txt })} keyboardType="numeric" />
                            <View style={styles.modalButtonContainer}>
                                <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setIsEditServiceModalVisible(false)}>
                                <Text style={styles.modalButtonText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.modalButton, styles.saveButton]} onPress={handleUpdateService}>
                                <Text style={styles.modalButtonText}>Save</Text>
                                </TouchableOpacity>
                            </View>
                            </>
                        )}
                    </View>
                </View>
            </Modal>

            {/* Delete Service Confirmation */}
            {serviceToDelete && (
                <Modal visible={isDeleteServiceConfirmModalVisible} transparent animationType="fade" onRequestClose={() => setIsDeleteServiceConfirmModalVisible(false)}>
                    <View style={styles.confirmModalContainer}>
                        <View style={styles.confirmModalContent}>
                            <Text style={styles.confirmModalTitle}>Delete Service</Text>
                            <Text style={styles.confirmModalText}>Remove "{serviceToDelete?.name}"?</Text>
                            <View style={styles.modalButtonContainer}>
                                <TouchableOpacity style={[styles.modalButton, styles.modalDeleteButton]} onPress={executeDeleteService}>
                                    <Text style={styles.modalButtonText}>Delete</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setIsDeleteServiceConfirmModalVisible(false)}>
                                    <Text style={styles.modalButtonText}>Cancel</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>
            )}
        </View>
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
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: screenHeight * 0.02,
        paddingHorizontal: screenWidth * 0.03,
        paddingTop: screenHeight * 0.01,
        paddingBottom: screenHeight * 0.015,
        borderBottomWidth: 1,
        borderBottomColor: '#EFEFEF',
    },
    cardTitle: {
        fontSize: screenWidth * 0.055,
        fontWeight: '700',
        color: '#333',
    },
    addButton: {
        backgroundColor: '#28A745',
        padding: screenWidth * 0.03,
        borderRadius: screenWidth * 0.06,
        width: screenWidth * 0.1,
        height: screenWidth * 0.1,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#28A745',
        shadowOffset: { width: 0, height: screenHeight * 0.002 },
        shadowOpacity: 0.3,
        shadowRadius: screenWidth * 0.01,
        elevation: 3,
    },
    listItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#FDFDFD',
        borderRadius: screenWidth * 0.03,
        paddingVertical: screenHeight * 0.02,
        paddingHorizontal: screenWidth * 0.04,
        marginBottom: screenHeight * 0.01,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: screenHeight * 0.002 },
        shadowOpacity: 0.05,
        shadowRadius: screenWidth * 0.01,
        elevation: 2,
    },
    listItemInfo: {
        flex: 1,
        marginRight: screenWidth * 0.03,
    },
    itemName: {
        fontSize: screenWidth * 0.045,
        fontWeight: '700',
        color: '#333',
        marginBottom: screenHeight * 0.002,
    },
    itemPrice: {
        fontSize: screenWidth * 0.045,
        color: '#28A745',
        fontWeight: 'bold',
    },
    listItemActions: {
        flexDirection: 'row',
    },
    listItemActionButton: {
        paddingHorizontal: screenWidth * 0.03,
        paddingVertical: screenHeight * 0.01,
        backgroundColor: '#F0F8FF',
        borderRadius: screenWidth * 0.04,
        marginLeft: screenWidth * 0.02,
    },
    noDataText: {
        fontSize: screenWidth * 0.04,
        color: '#999',
        textAlign: 'center',
        paddingVertical: screenHeight * 0.03,
        fontStyle: 'italic',
    },
    modalContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "rgba(0,0,0,0.6)",
    },
    modalContent: {
        width: "90%",
        maxHeight: '90%',
        backgroundColor: "#FFFFFF",
        padding: screenWidth * 0.05,
        borderRadius: screenWidth * 0.06,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: screenHeight * 0.01 },
        shadowOpacity: 0.25,
        shadowRadius: screenWidth * 0.06,
        elevation: 20,
    },
    modalTitle: {
        fontSize: screenWidth * 0.06,
        fontWeight: "bold",
        marginBottom: screenHeight * 0.025,
        color: "#007BFF",
        textAlign: 'center',
    },
    inputLabel: {
        alignSelf: 'flex-start',
        fontSize: screenWidth * 0.04,
        color: '#444',
        marginBottom: screenHeight * 0.01,
        fontWeight: '600',
    },
    input: {
        width: "100%",
        borderWidth: 1,
        borderColor: "#E0E0E0",
        borderRadius: screenWidth * 0.03,
        padding: screenHeight * 0.015,
        marginBottom: screenHeight * 0.015,
        fontSize: screenWidth * 0.04,
        backgroundColor: "#F9F9F9",
        color: '#333',
    },
    modalButtonContainer: {
        flexDirection: "row",
        justifyContent: "space-around",
        width: "100%",
        marginTop: screenHeight * 0.03,
    },
    modalButton: {
        paddingVertical: screenHeight * 0.02,
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
    saveButton: {
        backgroundColor: "#28A745",
    },
    cancelButton: {
        backgroundColor: "#6C757D",
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
        marginBottom: screenHeight * 0.03,
        lineHeight: screenHeight * 0.025,
    },
    modalDeleteButton: {
        backgroundColor: '#E74C3C',
    },
});

export default ServicesList;