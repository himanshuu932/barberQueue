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
} from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";

const API_BASE_URL = 'https://numbr-exq6.onrender.com/api';

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
                        <TouchableOpacity style={[styles.modalButton, styles.saveButton]} onPress={handleAddService}>
                        <Text style={styles.modalButtonText}>Add</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setIsAddServiceModalVisible(false)}>
                        <Text style={styles.modalButtonText}>Cancel</Text>
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
                                <TouchableOpacity style={[styles.modalButton, styles.saveButton]} onPress={handleUpdateService}>
                                <Text style={styles.modalButtonText}>Save</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setIsEditServiceModalVisible(false)}>
                                <Text style={styles.modalButtonText}>Cancel</Text>
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
        borderRadius: 15,
        padding: 10,
        marginBottom: 15,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 5,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 18,
        paddingHorizontal: 10,
        paddingTop: 5,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#EFEFEF',
    },
    cardTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: '#333',
    },
    addButton: {
        backgroundColor: '#28A745',
        padding: 10,
        borderRadius: 25,
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#28A745',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 3,
    },
    listItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#FDFDFD',
        borderRadius: 10,
        paddingVertical: 15,
        paddingHorizontal: 15,
        marginBottom: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    listItemInfo: {
        flex: 1,
        marginRight: 10,
    },
    itemName: {
        fontSize: 17,
        fontWeight: '700',
        color: '#333',
        marginBottom: 2,
    },
    itemPrice: {
        fontSize: 17,
        color: '#28A745',
        fontWeight: 'bold',
    },
    listItemActions: {
        flexDirection: 'row',
    },
    listItemActionButton: {
        paddingHorizontal: 10,
        paddingVertical: 8,
        backgroundColor: '#F0F8FF',
        borderRadius: 15,
        marginLeft: 8,
    },
    noDataText: {
        fontSize: 16,
        color: '#999',
        textAlign: 'center',
        paddingVertical: 25,
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
        padding: 20,
        borderRadius: 25,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 25,
        elevation: 20,
    },
    modalTitle: {
        fontSize: 24,
        fontWeight: "bold",
        marginBottom: 20,
        color: "#007BFF",
        textAlign: 'center',
    },
    inputLabel: {
        alignSelf: 'flex-start',
        fontSize: 16,
        color: '#444',
        marginBottom: 6,
        fontWeight: '600',
    },
    input: {
        width: "100%",
        borderWidth: 1,
        borderColor: "#E0E0E0",
        borderRadius: 10,
        padding: 15,
        marginBottom: 15,
        fontSize: 16,
        backgroundColor: "#F9F9F9",
        color: '#333',
    },
    modalButtonContainer: {
        flexDirection: "row",
        justifyContent: "space-around",
        width: "100%",
        marginTop: 25,
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
    modalDeleteButton: {
        backgroundColor: '#E74C3C',
    },
});

export default ServicesList;