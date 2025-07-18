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
  Dimensions
} from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");
const API_BASE_URL = 'https://numbr-exq6.onrender.com/api';

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
            const data = await response.json();
            // console.log('Add Barber Response:', data);
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
                            <Text style={styles.itemSubText}>Served: {barber.customersServed || 0}</Text>
                            <Text style={styles.itemSubText}>Rating: { (barber.rating || 0).toFixed(2) }⭐ </Text>
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
                        <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setIsAddBarberModalVisible(false)}>
                        <Text style={styles.modalButtonText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.modalButton, styles.saveButton]} onPress={handleAddBarber}>
                        <Text style={styles.modalButtonText}>Add</Text>
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
                            <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setIsEditBarberModalVisible(false)}>
                                <Text style={styles.modalButtonText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.modalButton, styles.saveButton]} onPress={handleSaveBarberChanges}>
                                <Text style={styles.modalButtonText}>Save</Text>
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
        marginLeft: screenWidth * 0.04,
    },
    itemName: {
        fontSize: screenWidth * 0.045,
        fontWeight: '700',
        color: '#333',
        marginBottom: screenHeight * 0.002,
    },
    itemSubText: {
        fontSize: screenWidth * 0.038,
        color: '#777',
        marginTop: screenHeight * 0.002,
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
    barberAvatar: {
        borderRadius: "40%",
        backgroundColor: '#E8EAF6',
        padding: screenWidth * 0.015,
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

export default BarbersList;