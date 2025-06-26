// FileName: BarbersList.js
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

const API_BASE_URL = 'https://numbr-p7zc.onrender.com/api';

const BarbersList = ({ barbers, shopId, userToken, onBarbersUpdate }) => {
    const [isAddBarberModalVisible, setIsAddBarberModalVisible] = useState(false);
    const [newBarberData, setNewBarberData] = useState({ name: '', email: '', password: '' }); // Changed 'phone' to 'email'
    
    const [isEditBarberModalVisible, setIsEditBarberModalVisible] = useState(false);
    const [editingBarber, setEditingBarber] = useState(null);
    const [editedBarberData, setEditedBarberData] = useState({ name: '', email: '', password: '' }); // Changed 'phone' to 'email'

    const [isDeleteBarberConfirmModalVisible, setIsDeleteBarberConfirmModalVisible] = useState(false);
    const [barberToDelete, setBarberToDelete] = useState(null);

    const handleAddBarber = async () => {
        if (!newBarberData.name || !newBarberData.email || !newBarberData.password) { // Changed 'phone' to 'email'
            Alert.alert("Validation Error", "Name, Email, and Password are required."); // Changed message
            return;
        }
        if (!shopId || !userToken) {
            Alert.alert("Error", "Shop or token missing.");
            return;
        }
        try {
            const response = await fetch(`${API_BASE_URL}/barbers`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userToken}` },
                body: JSON.stringify({ shopId: shopId, name: newBarberData.name, email: newBarberData.email, pass: newBarberData.password }), // Changed 'phone' to 'email'
            });
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.message || 'Failed to create barber.');
            }
            Alert.alert("Success", "Barber added!");
            setNewBarberData({ name: '', email: '', password: '' }); // Changed 'phone' to 'email'
            setIsAddBarberModalVisible(false);
            await onBarbersUpdate();
        } catch (err) {
            console.error('Error adding barber:', err);
            Alert.alert("Error", err.message);
        }
    };

    const handleOpenEditBarberModal = (barber) => {
        setEditingBarber(barber);
        setEditedBarberData({ name: barber.name, email: barber.email, password: '' }); // Changed 'phone' to 'email'
        setIsEditBarberModalVisible(true);
    };

    const handleSaveBarberChanges = async () => {
        if (!editingBarber || !userToken) {
            Alert.alert("Error", "No barber selected or token missing.");
            return;
        }
        if (!editedBarberData.name || !editedBarberData.email) { // Changed 'phone' to 'email'
            Alert.alert("Validation Error", "Name and Email are required."); // Changed message
            return;
        }
        const payload = {
            name: editedBarberData.name,
            email: editedBarberData.email, // Changed 'phone' to 'email'
        };
        if (editedBarberData.password) {
            payload.pass = editedBarberData.password;
        }
        try {
            const response = await fetch(`${API_BASE_URL}/barbers/${editingBarber._id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userToken}` },
                body: JSON.stringify(payload),
            });
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.message || 'Failed to update barber.');
            }
            Alert.alert("Success", "Barber details updated!");
            setIsEditBarberModalVisible(false);
            setEditingBarber(null);
            await onBarbersUpdate();
        } catch (err) {
            console.error('Error updating barber:', err);
            Alert.alert("Error", err.message);
        }
    };

    const confirmDeleteBarber = (barber) => {
        setBarberToDelete(barber);
        setIsDeleteBarberConfirmModalVisible(true);
    };

    const executeDeleteBarber = async () => {
        if (!barberToDelete || !userToken) {
            Alert.alert("Error", "Barber or token missing.");
            return;
        }
        try {
            const response = await fetch(`${API_BASE_URL}/barbers/${barberToDelete._id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${userToken}` },
            });
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.message || 'Failed to delete barber.');
            }
            Alert.alert("Success", "Barber removed!");
            setIsDeleteBarberConfirmModalVisible(false);
            setBarberToDelete(null);
            await onBarbersUpdate();
        } catch (err) {
            console.error('Error deleting barber:', err);
            Alert.alert("Error", err.message);
        }
    };

    return (
        <View style={styles.card}>
            <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Barbers</Text>
                <TouchableOpacity
                    style={styles.addButton}
                    onPress={() => setIsAddBarberModalVisible(true)}
                >
                    <Icon name="plus" size={16} color="#fff" />
                </TouchableOpacity>
            </View>

            {barbers && barbers.length > 0 ? (
                barbers.map(barber => (
                    <View key={barber._id} style={styles.listItem}>
                        <View style={styles.barberAvatar}>
                            <Icon name="user-circle" size={36} color="#6C757D" />
                        </View>
                        <View style={styles.listItemInfo}>
                            <Text style={styles.itemName}>{barber.name}</Text>
                            <Text style={styles.itemSubText}>{barber.email}</Text> {/* Changed 'phone' to 'email' */}
                            <Text style={styles.itemSubText}>Served: {barber.customersServed || 0}</Text>
                        </View>
                        <View style={styles.listItemActions}>
                            <TouchableOpacity
                                style={styles.listItemActionButton}
                                onPress={() => handleOpenEditBarberModal(barber)}
                            >
                                <Icon name="pencil" size={16} color="#007BFF" />
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.listItemActionButton}
                                onPress={() => confirmDeleteBarber(barber)}
                            >
                                <Icon name="trash" size={16} color="#DC3545" />
                            </TouchableOpacity>
                        </View>
                    </View>
                ))
            ) : (
                <Text style={styles.noDataText}>No barbers listed yet</Text>
            )}

            {/* Add Barber Modal */}
            <Modal visible={isAddBarberModalVisible} transparent animationType="slide" onRequestClose={() => setIsAddBarberModalVisible(false)}>
                <View style={styles.modalContainer}>
                    <View style={styles.modalContent}>
                    <Text style={styles.modalTitle}>Add Barber</Text>
                    <Text style={styles.inputLabel}>Name:</Text>
                    <TextInput style={styles.input} value={newBarberData.name} onChangeText={txt => setNewBarberData({ ...newBarberData, name: txt })} />
                    <Text style={styles.inputLabel}>Email:</Text> {/* Changed 'Phone' to 'Email' */}
                    <TextInput style={styles.input} value={newBarberData.email} onChangeText={txt => setNewBarberData({ ...newBarberData, email: txt })} keyboardType="email-address" /> {/* Changed keyboardType */}
                    <Text style={styles.inputLabel}>Password:</Text>
                    <TextInput style={styles.input} value={newBarberData.password} onChangeText={txt => setNewBarberData({ ...newBarberData, password: txt })} secureTextEntry />
                    <View style={styles.modalButtonContainer}>
                        <TouchableOpacity style={[styles.modalButton, styles.saveButton]} onPress={handleAddBarber}>
                        <Text style={styles.modalButtonText}>Add</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setIsAddBarberModalVisible(false)}>
                        <Text style={styles.modalButtonText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                    </View>
                </View>
            </Modal>

            {/* Edit Barber Modal */}
            <Modal visible={isEditBarberModalVisible} transparent animationType="slide" onRequestClose={() => setIsEditBarberModalVisible(false)}>
                <View style={styles.modalContainer}>
                    <View style={styles.modalContent}>
                    <Text style={styles.modalTitle}>Edit Barber</Text>
                    {editingBarber && (
                        <>
                        <Text style={styles.inputLabel}>Name:</Text>
                        <TextInput style={styles.input} value={editedBarberData.name} onChangeText={txt => setEditedBarberData({ ...editedBarberData, name: txt })} />
                        <Text style={styles.inputLabel}>Email:</Text> {/* Changed 'Phone' to 'Email' */}
                        <TextInput style={styles.input} value={editedBarberData.email} onChangeText={txt => setEditedBarberData({ ...editedBarberData, email: txt })} keyboardType="email-address" /> {/* Changed keyboardType */}
                        <Text style={styles.inputLabel}>New Password (optional):</Text>
                        <TextInput style={styles.input} placeholder="Leave blank to keep current" value={editedBarberData.password} onChangeText={txt => setEditedBarberData({ ...editedBarberData, password: txt })} secureTextEntry />
                        <View style={styles.modalButtonContainer}>
                            <TouchableOpacity style={[styles.modalButton, styles.saveButton]} onPress={handleSaveBarberChanges}>
                                <Text style={styles.modalButtonText}>Save</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setIsEditBarberModalVisible(false)}>
                                <Text style={styles.modalButtonText}>Cancel</Text>
                            </TouchableOpacity>
                        </View>
                        </>
                    )}
                    </View>
                </View>
            </Modal>

             {/* Delete Barber Confirmation */}
            {barberToDelete && (
                <Modal visible={isDeleteBarberConfirmModalVisible} transparent animationType="fade" onRequestClose={() => setIsDeleteBarberConfirmModalVisible(false)}>
                    <View style={styles.confirmModalContainer}>
                        <View style={styles.confirmModalContent}>
                            <Text style={styles.confirmModalTitle}>Delete Barber</Text>
                            <Text style={styles.confirmModalText}>Remove "{barberToDelete?.name}"?</Text>
                            <View style={styles.modalButtonContainer}>
                                <TouchableOpacity style={[styles.modalButton, styles.modalDeleteButton]} onPress={executeDeleteBarber}>
                                    <Text style={styles.modalButtonText}>Delete</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setIsDeleteBarberConfirmModalVisible(false)}>
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
        marginLeft: 15,
    },
    itemName: {
        fontSize: 17,
        fontWeight: '700',
        color: '#333',
        marginBottom: 2,
    },
    itemSubText: {
        fontSize: 14,
        color: '#777',
        marginTop: 2,
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
    barberAvatar: {
        borderRadius: 20,
        backgroundColor: '#E8EAF6',
        padding: 5,
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

export default BarbersList;