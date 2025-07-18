import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import React, { useEffect, useRef, useState, useCallback } from "react";
import {
    View,
    Text,
    StyleSheet,
    Image,
    TouchableOpacity,
    Animated,
    Alert,
    ActivityIndicator,
    Modal,
    TextInput,
    Linking,
    ImageBackground,
    ScrollView,
    Dimensions,
    Platform
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Icon from "react-native-vector-icons/FontAwesome";

const { height: screenHeight, width: screenWidth } = Dimensions.get('window');
const API_BASE = "http://10.0.2.2:5000";

export default function TabProfileScreen() {
    const router = useRouter();
    const shineAnimation = useRef(new Animated.Value(0)).current;

    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [isLogoutModalVisible, setIsLogoutModalVisible] = useState(false);
    const [editedProfile, setEditedProfile] = useState({
        name: "",
        email: "",
        // [ADDED]
        phone: "",
    });
    const [ownerId, setOwnerId] = useState(null);

    const [isPasswordModalVisible, setIsPasswordModalVisible] = useState(false);
    const [passwordStep, setPasswordStep] = useState(1);
    const [passwordData, setPasswordData] = useState({
        otp: '',
        newPassword: '',
        confirmPassword: ''
    });
    const [isPasswordLoading, setIsPasswordLoading] = useState(false);

    useFocusEffect(
        useCallback(() => {
            const getOwnerIdAndProfile = async () => {
                try {
                    const uid = await AsyncStorage.getItem("uid");
                    if (!uid) {
                        console.error("Owner ID not found in AsyncStorage");
                        router.replace("../pre-login");
                        return;
                    }
                    setOwnerId(uid);
                    await fetchProfile(uid);
                } catch (error) {
                    console.error("Error in useFocusEffect:", error);
                }
            };
            getOwnerIdAndProfile();
        }, [])
    );

    const fetchProfile = async (uid) => {
        try {
            const token = await AsyncStorage.getItem("userToken");
            const response = await fetch(`${API_BASE}/api/owners/profile`, {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            const data = await response.json();
            setProfile(data.data);
        } catch (error) {
            console.error("Error fetching profile:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(shineAnimation, {
                    toValue: 1,
                    duration: 2000,
                    useNativeDriver: true,
                }),
                Animated.timing(shineAnimation, {
                    toValue: 0,
                    duration: 0,
                    useNativeDriver: true,
                }),
            ])
        ).start();
    }, [shineAnimation]);

    const shineTranslateX = shineAnimation.interpolate({
        inputRange: [0, 1],
        outputRange: [-screenWidth * 0.5, screenWidth * 1.8],
    });
    const shineTranslateY = shineAnimation.interpolate({
        inputRange: [0, 1],
        outputRange: [-screenHeight * 0.9, screenHeight * 0.3],
    });

    const confirmLogout = async () => {
        try {
            await AsyncStorage.removeItem("userToken");
            await AsyncStorage.removeItem("uid");
            await AsyncStorage.removeItem("userType");
            await AsyncStorage.removeItem("userName");
            router.replace("../pre-login");
        } catch (error) {
            console.error("Error logging out:", error);
            Alert.alert("Logout Error", "Failed to log out. Please try again.");
        } finally {
            setIsLogoutModalVisible(false);
        }
    };

    // [MODIFIED] This function now updates name, email, and phone.
    async function updateOwnerProfile() {
        try {
            // [MODIFIED]
            const { name, email, phone } = editedProfile;
            const token = await AsyncStorage.getItem("userToken");

            // [MODIFIED]
            const updateData = { name, email, phone };

            const response = await fetch(`${API_BASE}/api/owners/profile`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(updateData),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || "Failed to update profile");
            }

            setIsModalVisible(false);
            fetchProfile(ownerId);
            Alert.alert("Success", "Profile updated successfully!");
        } catch (error) {
            console.error("Error updating profile:", error);
            Alert.alert("Error", error.message || "Failed to update profile");
        }
    }

    const handleInitiatePasswordChange = async () => {
        try {
            setIsPasswordLoading(true);
            const token = await AsyncStorage.getItem("userToken");
            if (!token) throw new Error("Authentication token missing");

            const response = await fetch(`${API_BASE}/api/owners/change-password/initiate`, {
                method: "POST",
                headers: { "Authorization": `Bearer ${token}` },
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || "Failed to initiate password change");
            }

            Alert.alert("Success", "An OTP has been sent to your registered email.");
            setPasswordStep(2);
        } catch (error) {
            Alert.alert("Error", error.message);
        } finally {
            setIsPasswordLoading(false);
        }
    };

    const handleConfirmPasswordChange = async () => {
        if (passwordData.newPassword !== passwordData.confirmPassword) {
            Alert.alert("Error", "Passwords do not match.");
            return;
        }

        try {
            setIsPasswordLoading(true);
            const token = await AsyncStorage.getItem("userToken");
            const response = await fetch(`${API_BASE}/api/owners/change-password/confirm`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                },
                body: JSON.stringify({
                    otp: passwordData.otp,
                    newPassword: passwordData.newPassword
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || "Failed to change password");
            }

            Alert.alert("Success", "Password changed successfully.");
            setIsPasswordModalVisible(false);
            setPasswordStep(1);
            setPasswordData({ otp: '', newPassword: '', confirmPassword: '' });
        } catch (error) {
            Alert.alert("Error", error.message);
        } finally {
            setIsPasswordLoading(false);
        }
    };


    return (
        <ImageBackground source={require("../image/bglogin.png")} style={styles.backgroundImage}>
            <View style={styles.overlay} />
            <View style={styles.container}>
                    {/* Profile Box */}
                    <View style={styles.profileBox}>
                        <LinearGradient colors={["#1a1a1a", "#333333", "#1a1a1a"]} style={styles.profileBackground}>
                            {/* Edit Button */}
                            <TouchableOpacity
                                style={styles.editButton}
                                onPress={() => {
                                    // [MODIFIED]
                                    setEditedProfile({
                                        name: profile?.name || "",
                                        email: profile?.email || "",
                                        phone: profile?.phone || "",
                                    });
                                    setIsModalVisible(true);
                                }}
                            >
                                <Image source={require("../image/editw.png")} style={styles.editIcon} />
                            </TouchableOpacity>

                            {/* Logout Button */}
                            <TouchableOpacity style={styles.logoutButton} onPress={() => setIsLogoutModalVisible(true)}>
                                <Icon name="sign-out" size={screenWidth * 0.06} color="white" />
                            </TouchableOpacity>

                            <Animated.View
                                style={[
                                    styles.shine,
                                    { transform: [{ translateX: shineTranslateX }, { translateY: shineTranslateY }, { rotate: "45deg" }] },
                                ]}
                            >
                                <LinearGradient
                                    colors={["transparent", "rgba(255, 255, 255, 0.3)", "transparent"]}
                                    start={{ x: 0, y: 0 }}
              _                    end={{ x: 1, y: 0 }}
                                    style={styles.shineGradient}
                                />
                            </Animated.View>
                            <View style={styles.profileContent}>
                                <Image source={require("../image/user.png")} style={styles.profileImage} />
                                <View style={styles.profileDetails}>
                                    {loading ? (
                                        <ActivityIndicator size="large" color="#fff" />
                                    ) : (
                                        <View>
                                            <Text style={styles.username}>{profile?.name || "Owner Name"}</Text>
                                            <Text style={styles.userInfo}>Email: {profile?.email || "N/A"}</Text>
                                                {/* [FIXED] Changed label to "Phone" */}
                                            <Text style={styles.userInfo}>Phone: {profile?.phone|| "N/A"}</Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                        </LinearGradient>
                    </View>

                    {/* Company / Info Section */}
                    <View style={styles.companyContainer}>
                        <LinearGradient colors={["#1a1a1a", "#2c2c2c", "#1a1a1a"]} style={styles.companyBackground}>
                            <Text style={styles.companyTitle}>Bludgers Technologies</Text>
                            <Text style={styles.companyTagline}>Innovating Daily Living</Text>
                            <Text style={styles.companyDescription}>
                                Bludgers Technologies is dedicated to crafting seamless and intuitive mobile applications,
                                ensuring the best user experience with cutting-edge solutions.
                            </Text>
                        </LinearGradient>
                    </View>

                    <View style={styles.infoContainer}>
          _         <LinearGradient colors={["#1a1a1a", "#2c2c2c", "#1a1a1a"]} style={styles.infoBackground}>
                        <View style={styles.infoGrid}>
                                <TouchableOpacity style={styles.infoGridItem} onPress={() => Linking.openURL("https://www.numbrapp.in/terms")}>
                                    <Text style={styles.infoLinkText}>Terms & Conditions</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.infoGridItem} onPress={() => Linking.openURL("https://www.numbrapp.in/refund")}>
                                    <Text style={styles.infoLinkText}>Refund Policy</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.infoGridItem} onPress={() => Linking.openURL("https://www.numbrapp.in/privacy")}>
                                    <Text style={styles.infoLinkText}>Privacy Policy</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.infoGridItem} onPress={() => Linking.openURL("https://www.numbrapp.in/contact")}>
                                    <Text style={styles.infoLinkText}>Contact Us</Text>
                                </TouchableOpacity>
                            </View>
                        </LinearGradient>
                    </View>

                {/* Edit Profile Modal */}
                <Modal visible={isModalVisible} transparent animationType="slide">
                    <View style={styles.modalContainer}>
                        <View style={styles.modalContent}>
                            <Text style={styles.modalTitle}>Edit Profile</Text>

                            <View style={styles.inputContainer}>
                                <Text style={styles.inputLabel}>Name</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Name"
                                    value={editedProfile.name}
                                    onChangeText={(text) => setEditedProfile({ ...editedProfile, name: text })}
                                />
                            </View>

                            <View style={styles.inputContainer}>
                                <Text style={styles.inputLabel}>Email</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Email"
                                    value={editedProfile.email}
                                    keyboardType="email-address"
                                    onChangeText={(text) => setEditedProfile({ ...editedProfile, email: text })}
                                />
                            </View>

                            {/* [ADDED] New input section for Phone */}
                            <View style={styles.inputContainer}>
                                <Text style={styles.inputLabel}>Phone</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Phone Number"
                                    value={editedProfile.phone}
                                    keyboardType="phone-pad"
                                    onChangeText={(text) => setEditedProfile({ ...editedProfile, phone: text })}
                                />
                            </View>
                            
                            <TouchableOpacity
                                style={styles.changePasswordLink}
                                onPress={() => {
                                    setIsModalVisible(false);
                                    setIsPasswordModalVisible(true);
                                }}
                            >
                                <Text style={styles.changePasswordLinkText}>Change Password?</Text>
                            </TouchableOpacity>

                            <View style={styles.modalButtonContainer}>
                                <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setIsModalVisible(false)}>
                                    <Text style={styles.modalButtonText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.modalButton, styles.saveButton]} onPress={updateOwnerProfile}>
                                    <Text style={styles.modalButtonText}>Save</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>

                {/* Change Password Modal */}
                <Modal visible={isPasswordModalVisible} transparent animationType="slide">
                    <View style={styles.modalContainer}>
                        <View style={styles.modalContent}>
                            <Text style={styles.modalTitle}>
                                {passwordStep === 1 ? 'Initiate Password Change' : 'Confirm New Password'}
                            </Text>

                            {passwordStep === 1 ? (
                                <>
                                    <Text style={styles.modalMessage}>
                                        We'll send an OTP to your registered email to verify your identity.
                                    </Text>
                                    <View style={styles.modalButtonContainer}>
                                        <TouchableOpacity
                                            style={[styles.modalButton, styles.cancelButton]}
                                            onPress={() => setIsPasswordModalVisible(false)}
                                        >
                                            <Text style={styles.modalButtonText}>Cancel</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[styles.modalButton, styles.saveButton]}
                          _                 onPress={handleInitiatePasswordChange}
                                            disabled={isPasswordLoading}
                                        >
                                            {isPasswordLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalButtonText}>Send OTP</Text>}
                                        </TouchableOpacity>
                _                 </View>
                                </>
                            ) : (
                                <>
                                    <View style={styles.inputContainer}>
                                        <Text style={styles.inputLabel}>OTP</Text>
                                        <TextInput
                                            style={styles.input}
                                            placeholder="Enter OTP from email"
                                            value={passwordData.otp}
                                            onChangeText={(text) => setPasswordData({ ...passwordData, otp: text })}
                                            keyboardType="numeric"
                                        />
                                    </View>
                                    <View style={styles.inputContainer}>
                                        <Text style={styles.inputLabel}>New Password</Text>
                                        <TextInput
                                            style={styles.input}
                                            placeholder="Enter new password"
                                            value={passwordData.newPassword}
                                            onChangeText={(text) => setPasswordData({ ...passwordData, newPassword: text })}
                                            secureTextEntry
                                        />
                                    </View>
                                    <View style={styles.inputContainer}>
                                        <Text style={styles.inputLabel}>Confirm Password</Text>
                                        <TextInput
                                            style={styles.input}
                                            placeholder="Confirm new password"
                                            value={passwordData.confirmPassword}
                                            onChangeText={(text) => setPasswordData({ ...passwordData, confirmPassword: text })}
                                            secureTextEntry
                    _                 />
                                    </View>
                                    <View style={styles.modalButtonContainer}>
                                        <TouchableOpacity
                                            style={[styles.modalButton, styles.cancelButton]}
                                            onPress={() => {
                                                setIsPasswordModalVisible(false);
                                                setPasswordStep(1);
                                                setPasswordData({ otp: '', newPassword: '', confirmPassword: '' });
                                            }}
                                        >
                                            <Text style={styles.modalButtonText}>Cancel</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[styles.modalButton, styles.saveButton]}
                                            onPress={handleConfirmPasswordChange}
                                            disabled={isPasswordLoading}
                                        >
                                            {isPasswordLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalButtonText}>Change Password</Text>}
                                        </TouchableOpacity>
                                    </View>
                                </>
                            )}
                        </View>
                    </View>
                </Modal>


                {/* Modal for Logout Confirmation */}
                <Modal visible={isLogoutModalVisible} transparent animationType="fade">
                    <View style={styles.modalContainer}>
                        <View style={styles.modalContent}>
                            <Text style={styles.modalTitle}>Confirm Logout</Text>
                            <Text style={styles.modalMessage}>Are you sure you want to log out?</Text>
                            <View style={styles.modalButtonContainer}>
                                <TouchableOpacity style={[styles.modalButton, { backgroundColor: '#FF6347' }]} onPress={() => setIsLogoutModalVisible(false)}>
                                    <Text style={styles.modalButtonText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.modalButton, { backgroundColor: '#1a1a1a' }]} onPress={confirmLogout}>
                                    <Text style={styles.modalButtonText}>Logout</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>
            </View>
        </ImageBackground>
    );
}

const styles = StyleSheet.create({
    backgroundImage: {
        flex: 1,
        resizeMode: "cover",
        width: "100%",
        height: "100%",
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(237, 236, 236, 0.77)",
    },
    container: {
        flex: 1,
        width: screenWidth,
        padding: screenWidth * 0.05,
    },
    profileBox: {
        width: screenWidth * 0.9,
        height: screenHeight * 0.2,
        borderRadius: screenWidth * 0.04,
        overflow: "hidden",
        marginBottom: screenHeight * 0.02,
        elevation: 5,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: screenHeight * 0.005 },
        shadowOpacity: 0.3,
        shadowRadius: screenWidth * 0.02,
    },
    profileBackground: {
        width: "100%",
        height: "100%",
        justifyContent: "center",
        alignItems: "center",
        padding: screenWidth * 0.05,
    },
    shine: {
        position: "absolute",
        top: 0,
        left: 0,
        width: screenWidth * 0.8,
        height: screenHeight * 1.5,
    },
    shineGradient: {
        width: "100%",
        height: "100%",
    },
    profileContent: {
        flexDirection: "row",
        alignItems: "center",
        width: "100%",
    },
    profileImage: {
        width: screenWidth * 0.22,
        height: screenWidth * 0.22,
        borderRadius: screenWidth * 0.11,
        borderWidth: screenWidth * 0.007,
        borderColor: "#eee",
        marginRight: screenWidth * 0.05,
    },
    profileDetails: {
        flex: 1,
    },
    username: {
        fontSize: screenWidth * 0.06,
        fontWeight: "bold",
        color: "#fff",
        marginBottom: screenHeight * 0.005,
    },
    userInfo: {
        fontSize: screenWidth * 0.04,
        fontWeight: "400",
        color: "#f0f0f0",
        marginTop: screenHeight * 0.002,
    },
    editButton: {
        position: "absolute",
        top: screenHeight * 0.02,
        right: screenWidth * 0.15,
        padding: screenWidth * 0.02,
        borderRadius: screenWidth * 0.04,
        alignItems: "center",
        zIndex: 1,
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    editIcon: {
        width: screenWidth * 0.06,
        height: screenWidth * 0.06,
        tintColor: "white",
    },
    logoutButton: {
        position: 'absolute',
        top: screenHeight * 0.02,
        right: screenWidth * 0.04,
        padding: screenWidth * 0.02,
        borderRadius: screenWidth * 0.04,
        alignItems: 'center',
        zIndex: 1,
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    companyContainer: {
        width: screenWidth * 0.9,
        borderRadius: screenWidth * 0.04,
        overflow: "hidden",
        marginBottom: screenHeight * 0.03,
        elevation: 8,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: screenHeight * 0.005 },
        shadowOpacity: 0.2,
        shadowRadius: screenWidth * 0.02,
    },
    companyBackground: {
        padding: screenWidth * 0.05,
        borderRadius: screenWidth * 0.04,
    },
    companyTitle: {
        fontSize: screenWidth * 0.065,
        fontWeight: "bold",
        color: "#fff",
        marginBottom: screenHeight * 0.01,
        textAlign: "center",
    },
    companyTagline: {
        fontSize: screenWidth * 0.045,
        color: "#ddd",
        marginBottom: screenHeight * 0.02,
        fontStyle: "italic",
        textAlign: "center",
    },
    companyDescription: {
        fontSize: screenWidth * 0.04,
        color: "#ccc",
        textAlign: "justify",
        marginBottom: screenHeight * 0.02,
        paddingHorizontal: screenWidth * 0.02,
    },
    infoContainer: {
        width: screenWidth * 0.9,
        borderRadius: screenWidth * 0.04,
        overflow: "hidden",
        marginBottom: screenHeight * 0.03,
        elevation: 8,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: screenHeight * 0.005 },
        shadowOpacity: 0.2,
        shadowRadius: screenWidth * 0.02,
    },
    infoBackground: {
        padding: screenWidth * 0.05,
        borderRadius: screenWidth * 0.04,
    },
    infoGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: "center",
        paddingHorizontal: screenWidth * 0.02,
    },
    infoGridItem: {
        width: '50%',
        paddingVertical: screenHeight * 0.01,
        alignItems: "center",
    },
    infoLinkText: {
        fontSize: screenWidth * 0.032,
        width: screenWidth * 0.4,
        color: "#ADD8E6",
        textDecorationLine: "underline",
        textAlign: "left",
    },
    modalContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "rgba(0,0,0,0.6)",
    },
    modalContent: {
        width: screenWidth * 0.85,
        backgroundColor: "#fff",
        padding: screenWidth * 0.06,
        borderRadius: screenWidth * 0.04,
        elevation: 8,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: screenHeight * 0.005 },
        shadowOpacity: 0.25,
        shadowRadius: screenWidth * 0.02,
    },
    modalTitle: {
        fontSize: screenWidth * 0.055,
        fontWeight: "bold",
        marginBottom: screenHeight * 0.02,
        textAlign: "center",
        color: '#333',
    },
    modalMessage: {
        fontSize: screenWidth * 0.045,
        textAlign: 'center',
        marginBottom: screenHeight * 0.02,
        color: '#555',
    },
    inputContainer: {
        marginBottom: screenHeight * 0.02,
    },
    inputLabel: {
        marginBottom: screenHeight * 0.005,
        fontSize: screenWidth * 0.04,
        fontWeight: "bold",
        color: "#333",
    },
    input: {
        width: "100%",
        borderWidth: 1,
        borderColor: "#ddd",
        borderRadius: screenWidth * 0.02,
        padding: screenWidth * 0.04,
        fontSize: screenWidth * 0.04,
        color: '#333',
        backgroundColor: '#f9f9f9',
    },
    modalButtonContainer: {
        flexDirection: "row",
        justifyContent: "space-around",
        marginTop: screenHeight * 0.02,
    },
    modalButton: {
        flex: 1,
        backgroundColor: "#1a1a1a",
        padding: screenHeight * 0.015,
        borderRadius: screenWidth * 0.02,
        alignItems: "center",
        marginHorizontal: screenWidth * 0.02,
    },
    modalButtonText: {
        color: "#fff",
       fontSize: screenWidth * 0.045,
        fontWeight: "bold",
    },
    cancelButton: {
        backgroundColor: "#dc3545",
    },
    saveButton: {
        backgroundColor: "#28a745",
    },
    changePasswordLink: {
        marginTop: 15,
        marginBottom: 5,
        alignItems: 'center',
    },
    changePasswordLinkText: {
        color: '#1a1a1a',
        fontWeight: '600',
        fontSize: screenWidth * 0.04,
        textDecorationLine: 'underline',
    },
});