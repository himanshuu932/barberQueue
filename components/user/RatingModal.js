import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Dimensions, Alert } from 'react-native'; // Import Alert
import Icon from 'react-native-vector-icons/FontAwesome';

const { width } = Dimensions.get('window');

// RatingModal now accepts shopId and barberId as props
const RatingModal = ({ isVisible, onClose, shopId, barberId,historyId }) => { // Removed onSubmit prop
  const [currentRating, setCurrentRating] = useState(0);

  // Function to render star icons based on the current rating
  const renderStars = () => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <TouchableOpacity
          key={i}
          onPress={() => setCurrentRating(i)}
          style={styles.starButton}
        >
          <Icon
            name={i <= currentRating ? 'star' : 'star-o'} // 'star' for filled, 'star-o' for outline
            size={width * 0.08}
            color="#FFD700" // Gold color for stars
          />
        </TouchableOpacity>
      );
    }
    return stars;
  };

  // Handle submit button click - now handles alert and closes itself
  const handleSubmit = async() => {
    // Show alert with the rating, shopId, and barberId
    const token=await AsyncStorage.getItem('userToken')
    Alert.alert(
      "Rating Submitted",
      `User rated ${currentRating} stars!\nShop ID: ${historyId || 'N/A'}\nBarber ID: ${barberId || 'N/A'}`
    );
    const res=await fetch(`https://numbr-p7zc.onrender.com/api/barbers/rate/${barberId}`,{
        method: "PUT", 
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}` 
        },
        body: JSON.stringify({ rating: currentRating,hid:historyId}), 

    });
 
    console.log(res);
    console.log(`User rated: ${currentRating} stars, Shop ID: ${shopId}, Barber ID: ${barberId}`);
    setCurrentRating(0); // Reset rating after submission
    onClose(); // Close the modal through the parent's handler
  };

  // Handle modal close, resetting rating
  const handleClose = () => {
    onClose(); // Close the modal through the parent's handler
    setCurrentRating(0);
  };

  return (
    <Modal
      visible={isVisible}
      transparent={true}
      animationType="fade"
      onRequestClose={handleClose} // Handle Android back button
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Rate Your Service</Text>
          <Text style={styles.modalMessage}>How would you rate your experience?</Text>
          <View style={styles.starsContainer}>
            {renderStars()}
          </View>
          <View style={styles.modalButtonContainer}>
            <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={handleClose}>
              <Text style={styles.modalButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, styles.submitButton]}
              onPress={handleSubmit}
              disabled={currentRating === 0} // Disable submit if no stars are selected
            >
              <Text style={styles.modalButtonText}>Submit</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  modalContent: {
    width: '88%',
    backgroundColor: '#fff',
    padding: 25,
    borderRadius: 15,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: width * 0.06,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: width * 0.045,
    marginBottom: 20,
    color: '#555',
    textAlign: 'center',
  },
  starsContainer: {
    flexDirection: 'row',
    marginBottom: 25,
  },
  starButton: {
    padding: 5,
  },
  modalButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 8,
    elevation: 3,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  modalButtonText: {
    color: '#fff',
    fontSize: width * 0.045,
    fontWeight: 'bold',
  },
  cancelButton: {
    backgroundColor: '#dc3545', // Red for cancel
  },
  submitButton: {
    backgroundColor: '#28a745', // Green for submit
  },
});

export default RatingModal;
