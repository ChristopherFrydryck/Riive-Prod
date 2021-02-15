
import React from 'react';
import { ActivityIndicator, StyleSheet, StatusBar, Platform, View, ScrollView, SafeAreaView, Dimensions, KeyboardAvoidingView, Image, LogBox} from 'react-native';

import Text from '../components/Txt'
import Icon from '../components/Icon'
import Colors from '../constants/Colors'
import Input from '../components/Input'
import Button from '../components/Button'

import logo from '../assets/img/Logo_001.png'

//MobX Imports
import { inject, observer } from 'mobx-react/native'
import UserStore from '../stores/userStore'
import ComponentStore from '../stores/componentStore'


// Firebase imports
// import * as firebase from 'firebase'
import * as firebase from 'firebase/app';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import 'firebase/firestore';
import 'firebase/auth';


const providers = {
  googleProvider: new firebase.auth.GoogleAuthProvider(),
};



// Regex to check name and phone are valid at sign in
const regexFullname = /[^0-9]([a-zA-Z]{1,})+[ ]+([a-zA-Z-']{2,})*$/gi;
const regexPhone = /^\s*(?:\+?(\d{1,3}))?[-. (]*(\d{3})[-. )]*(\d{3})[-. ]*(\d{4})(?: *x(\d+))?\s*$/;

// Vars that prevent continuing since this is not built into firebase natively
let nameValid = false;
let phoneValid = false;

@inject("UserStore")
@observer
export default class Authentication extends React.Component {
  constructor(){
    super();

    this.state = {
      email: '',
      password: '',
      fullname: '',
      phone: '',
      stripeID: 'invalid',
      authenticating: false,
      toggleLogIn: true,

      // Errors that may show if firebase catches them.
      emailError: '',
      passwordError: '',
      fullnameError: '',
      phoneError: '',
    }
  }


  async componentDidMount(){
    // Remove after testing!!
    this.setState({email: 'admin@riive.net', password: 'Fallon430'})
    this.props.UserStore.email = 'admin@riive.net'
    this.props.UserStore.password = "Fallon430"

      // Set Status Bar page info here!
   this._navListener = this.props.navigation.addListener('didFocus', () => {
    StatusBar.setBarStyle('dark-content', true);
    Platform.OS === 'android' && StatusBar.setBackgroundColor('white');

  });

  }

  componentWillUnmount() {
    // Unmount status bar info
   this._navListener.remove();
  }

  createStripeCustomer = async () => {

    const settings = {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: this.props.UserStore.fullname,
        email: this.props.UserStore.email,
        phone: this.props.UserStore.phone,
        FBID: auth().currentUser.uid,
      })
    }
    try{
      const fetchResponse = await fetch('https://us-central1-riive-parking.cloudfunctions.net/addCustomer', settings)
      const data = await fetchResponse.json();
      return data;
    }catch(e){
      alert(e);
    }    
  }

  // Resets the password of the state with email
  resetPassword = () =>{
    auth().sendPasswordResetEmail(this.props.UserStore.email).then(function() {
        alert('Check your email for a password reset link.')
      }).catch(function(error) {
        alert('Failed to send password reset. ' + error.message)
    });
  }
  
   // Toggles between sign in and sign up on same page.
   toggleSignInOrUp() {
    // resets the errors and password for security reasons
    this.setState({ 
      toggleLogIn: !this.state.toggleLogIn,
      password: '',
      emailError: '',
      passwordError: '',
      fullnameError: '',
      phoneError: '',
    
    })
  }


  // Sign up authorization with email and password
  // also sends an email verification to the user
  onPressSignUp = () => {

     // Begin ActivityIndicator since auth == true
    this.setState ({ authenticating: true})

      // Checks if full name is in format of Firstname Lastname
      if(this.props.UserStore.fullname.match(regexFullname)){
        // alert('name valid')
        this.setState({fullnameError: ''})
        nameValid = true;
      }else{
        // alert('name invalid')
        this.setState({
          fullnameError: 'Please provide first and last name with a space.',
          authenticating: false
        });
        namevalid = false;
      }  

      // Checks phone for valid format (accepts many formats)
      if(this.props.UserStore.phone.match(regexPhone)){
        // alert('name valid')
        this.setState({phoneError: ''})
        phoneValid = true;
      }else{
        // alert('name invalid')
        this.setState({
          phoneError: 'Please provide a proper 10 digit phone number.',
          authenticating: false
        });
        phoneValid = false;
      }  
      

    // If vars are true and valid beguin creating user
    if(nameValid && phoneValid){
    
     auth().createUserWithEmailAndPassword(this.props.UserStore.email, this.props.UserStore.password).then((userCredentials) => {
        // RETURN ALL THIS IF EMAIL AND PASSWORD ARE TRUE

        this.setState({
          emailError: '',
          passwordError: '',
          fullnameError: '',
          phoneError: '',
        })  

        
        // Updates user's displayName in firebase auth
        if(userCredentials.user){
          this.props.UserStore.userID = auth().currentUser.uid;
           userCredentials.user.updateProfile({
            displayName: this.props.UserStore.fullname
           })
           userCredentials.user.updateEmail(this.props.UserStore.email).then(() => {
                this.props.UserStore.joinedDate = auth().currentUser.metadata.creationTime
                // IMPORTANT!!! Defines user location in database
                this.props.UserStore.userID = auth().currentUser.uid;
              }).then(() => {
                //start firestore
                const db = firestore();
                const doc = db.collection('users').doc(this.props.UserStore.userID);

                doc.get().then((docData) => {
                    db.collection("users").doc(this.props.UserStore.userID).set({
                      id: auth().currentUser.uid,
                      fullname: this.props.UserStore.fullname,
                      firstname: this.props.UserStore.firstname,
                      lastname: this.props.UserStore.lastname,
                      email: this.props.UserStore.email,
                      phone: this.props.UserStore.phone,
                      totalNumTimesParked: 0,
                      numTimesOpenedApp: 1,
                      listings: [],
                      vehicles: [],
                      payments: [],
                      trips: [],
                      photo: '',
                      joined_date: auth().currentUser.metadata.creationTime,
                      last_update: auth().currentUser.metadata.creationTime,
                      disabled: {
                        isDisabled: false,
                        disabledEnds: new Date().getTime() / 1000,
                        numTimesDisabled: 0,
                      },
                      deleted: {
                        isDeleted: false,
                        toBeDeleted: false,
                        deletedStarts: new Date().getTime() / 1000,
                      },
                      pushTokens: [],
                    })
                return docData
              }).then((doc) => {
                    // console.log(doc.data())
                    this.props.UserStore.fullname = this.props.UserStore.fullname;
                    this.props.UserStore.phone = this.props.UserStore.phone;
                    this.props.UserStore.stripeID = "";
                    this.props.UserStore.photo = "";
                    this.props.UserStore.joinedDate = auth().currentUser.metadata.creationTime;
                    this.props.UserStore.last_update = auth().currentUser.metadata.creationTime;
                    this.props.UserStore.vehicles = [];
                    this.props.UserStore.listings = [];
                    this.props.UserStore.payments = [];
                    this.props.UserStore.trips = [];
                    this.props.UserStore.searchHistory = [];
                    this.props.UserStore.disabled = false;
                    this.props.UserStore.deleted = false;
                    this.props.UserStore.pushTokens = [];
                  }).then(() => {
                    // alert('Welcome to Riive ' + this.props.UserStore.firstname + '!')
     
                  this.setState({ authenticating: false});
                  this.props.navigation.navigate('Home')
     
                  // ID if user signed in via email or google
                  this.props.UserStore.signInProvider = auth().currentUser.providerData[0].providerId;
     
                
     
                  
                  
               
     
              }).then(() => this.createStripeCustomer())
              .then(() =>  {
                // Sends email to valid user
                auth().currentUser.sendEmailVerification()
              })
                .catch((e) => {
                alert('Whoops! We accidently lost connection. Try signing up again.' + e)
                auth().currentUser.delete();
                })
        
                  
          
        })
      }
    }).catch(e => {
      // Handle Errors here.
      var errorCode = e.code;
      var errorMessage = e.message;
      this.setState ({ authenticating: false})
      // alert(errorCode + ': ' + errorMessage)
      if(errorCode == 'auth/invalid-email'){
        this.setState({
          emailError: 'Email format must be name@domain.com',
          passwordError: '',

        })
      }else if (errorCode == 'auth/email-already-in-use'){
        this.setState({
          emailError: 'Email is already in use with another account.',
          passwordError: '',

        })
      }else if (errorCode == 'auth/weak-password'){
        this.setState({
          emailError: '',
          passwordError: 'Password must be longer than 5 characters.',

        })
      }else{
        alert(errorCode + ': ' + errorMessage);
      }
    })
  }
}

onPressSignIn = async() => {

  this.setState ({ authenticating: true})


  auth().signInWithEmailAndPassword(this.props.UserStore.email, this.props.UserStore.password).then(async() => {
    // define user id before calling the db from it
    this.props.UserStore.userID = auth().currentUser.uid;
    this.setState({
      emailError: '',
      passwordError: '',
    })


    const db = firestore();

    const doc = db.collection('users').doc(this.props.UserStore.userID);

    const searchHistoryRef = db.collection('users').doc(this.props.UserStore.userID).collection('searchHistory');
    let searchHistory = new Array();


   await searchHistoryRef.get().then((doc) => {
     if(!doc.empty){
        doc.forEach(doc =>{
          searchHistory.push(doc.data())
        })
      }
   })
    
    

    

    // MOBX is not cached upon force close. Reinitalize data to mobx here!
      doc.get().then((doc) => {
        if (doc.exists){
                // alert(`${doc.id} => ${doc.data().fullname}`);
                this.props.UserStore.fullname = doc.data().fullname;
                this.props.UserStore.phone = doc.data().phone;
                this.props.UserStore.userID = doc.data().id;
                this.props.UserStore.stripeID = doc.data().stripeID;
                this.props.UserStore.photo = doc.data().photo;
                this.props.UserStore.joinedDate = auth().currentUser.metadata.creationTime;
                this.props.UserStore.last_update = doc.data().last_update;
                this.props.UserStore.vehicles = doc.data().vehicles;
                this.props.UserStore.listings = [];
                this.props.UserStore.trips = doc.data().trips;
                this.props.UserStore.payments = doc.data().payments;
                this.props.UserStore.searchHistory = searchHistory;
                this.props.UserStore.disabled = doc.data().disabled.isDisabled;
                this.props.UserStore.deleted = doc.data().deleted.toBeDeleted
                this.props.UserStore.pushTokens = doc.data().pushTokens || [];

                // ID if user signed in via email or google
                this.props.UserStore.signInProvider = auth().currentUser.providerData[0].providerId;
                
              
                var currentTime = firestore.Timestamp.now();

                // in case a user reverts their email change via profile update
                db.collection("users").doc(this.props.UserStore.userID).update({
                  last_update: currentTime,
                  email: this.props.UserStore.email,
                })
                // Upon setting the MobX State Observer, navigate to home
                this.props.navigation.navigate('Home')
            
                return doc;


      }else{
        throw("No user found")
      }
  }).then((doc) => {
    const length = doc.data().listings.length;
    if( length > 0 && length <= 10){
      db.collection('listings').where(firestore.FieldPath.documentId(), "in", doc.data().listings).get().then((qs) => {
        let listingsData = [];
        for(let i = 0; i < qs.docs.length; i++){
          listingsData.push(qs.docs[i].data())
        }
        this.props.UserStore.listings = listingsData;
    }).then(() => this.props.navigation.navigate("Home"))


  }else if(length > 0 && length > 10){
    let listings = doc.data().listings;
    let allArrs = [];
    var listingsData = [];
    while(listings.length > 0){
      allArrs.push(listings.splice(0, 10))
    }

    for(let i = 0; i < allArrs.length; i++){
      db.collection('listings').where(firestore.FieldPath.documentId(), "in", allArrs[i]).get().then((qs) => {
        for(let i = 0; i < qs.docs.length; i++){
          listingsData.push(qs.docs[i].data())
        }
      }).then(() => {
        this.props.UserStore.listings = listingsData;
        this.props.navigation.navigate('Home')
      })
    }
  
  }else{
     this.props.navigation.navigate('Home')
  }
     
  }).catch((e) => {
    alert("Failed to grab user data. Please try again. " + e)
  })

  
  // auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL).then(() => {
    // alert('Persisted!')
  // })


  }).catch( async (error) => {
    // Handle Errors here.
    var errorCode = error.code;
    var errorMessage = error.message;
    this.setState ({ authenticating: false})
    // alert(errorCode + ': ' + errorMessage)
    if(errorCode == 'auth/invalid-email'){
      this.setState({
        emailError: 'Email format must be name@domain.com',
        passwordError: '',

      })
    }else if(errorCode == 'auth/user-not-found'){
      this.setState({
        emailError: 'There is no account under this email',
        passwordError: '',

      })
    }else if(errorCode == 'auth/too-many-requests'){
      this.setState({
        emailError: 'Too many recent requests. Try again soon',
        passwordError: '',

      })
    }else if(errorCode == 'auth/wrong-password'){
      this.setState({
        passwordError: 'Password is incorrect or empty',
        emailError: '',
      })
    }else if(errorCode == 'auth/user-disabled'){
      const settings = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          "Access-Control-Request-Method": "POST"
        },
        body: JSON.stringify({
          email: this.props.UserStore.email,
        })
      }
  
        
        await fetch('https://us-central1-riive-parking.cloudfunctions.net/getUserDataFromEmail', settings).then((res) => {
          return res.json()
        }).then((body) => {
          const db = firestore();
          const doc = db.collection('users').doc(body.uid)
          return doc.get()
        }).then((user) => {
          console.log(user.exists)
          if(user.exists){
            if(user.data().disabled.numTimesDisabled < 3){
              var date = new Date(user.data().disabled.disabledEnds * 1000 + (24*60*60*1000));
              var daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
              var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
              this.setState({
                passwordError: '',
                emailError: `This account has been suspended until ${daysOfWeek[date.getDay()]} ${months[date.getMonth()]} ${date.getDate()}`,
              })
            }else{
              this.setState({
                passwordError: 'Reach out to support@riive.net for assistance',
                emailError: `This account has been banned`,
              })
            }
        }else{
          this.setState({
            passwordError: '',
            emailError: `This account has been suspended`,
          })
        }
        }).catch(e => {
          alert(e)
        })
       
      // console.log(this.props.UserStore.email)
      // const db = firebase.firestore();
      // const doc = db
      // doc.get().then((doc) => {
      //   console.log(doc)
        // if(doc.exists){
        //   if(doc.data().disabled.numTimesDisabled < 3){
        //     var date = new Date(doc.data().disabled.disabledEnds * 1000);
        //     var daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
        //     var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
        //     this.setState({
        //       passwordError: '',
        //       emailError: `This account has been suspended until ${daysOfWeek[date.getDay()]} ${months[date.getMonth()]} ${date.getDate()}`,
        //     })
        //   }else{
        //     this.setState({
        //       passwordError: 'Reach out to support@riive.net for assistance',
        //       emailError: `This account has been banned`,
        //     })
        //   }
        // }else{
        //   this.setState({
        //     passwordError: '',
        //     emailError: `This account has been suspended`,
        //   })
        // }
      // })
    }else{
      alert(errorCode + ': ' + errorMessage);
    }
  });

}

renderCurrentState() {
  if(this.state.authenticating){
    return(
      <View style={styles.form}>
        <ActivityIndicator size="large" color={Colors.cosmos300} />
        <Button style={{backgroundColor: "#FF8708"}} textStyle={{color:"#FFFFFF"}} onPress={() => this.setState({ authenticating: false})}>Cancel</Button>
      </View>
    )
  }else if(this.state.toggleLogIn){
    return(
        <View style={styles.form}>
          <Input 
          placeholder='Enter email...'
          label="Email"
          name="email"
          onChangeText = {(email) => this.props.UserStore.email = email}
          value={this.props.UserStore.email}
          keyboardType='email-address'
          maxLength = {55} 
          error={this.state.emailError}
          />
          <Input 
          placeholder='Enter password...'
          label="Password"
          name="password"
          secureTextEntry
          onChangeText = {(password) => this.props.UserStore.password = password}
          value={this.props.UserStore.password}
          maxLength = {55}
          keyboardType='default'
          error={this.state.passwordError}
          />
          <Button style={{backgroundColor: "#FF8708"}} textStyle={{color:"#FFFFFF"}} onPress = {() => this.onPressSignIn()}>Log In</Button>
          <Text onPress={() => this.toggleSignInOrUp()} style={styles.hyperlink}>Or Sign Up</Text>
          <Text onPress={() => this.resetPassword()} style={styles.hyperlink}>Forgot Password?</Text>
        </View>
    )
  }else{
    return(
     <View style={styles.form}>
        <Input 
        placeholder='Your name...'
        label="Full Name"
        name="full name"
        onChangeText= {(fullname) => this.props.UserStore.fullname = fullname}
        value={this.props.UserStore.fullname}
        maxLength = {40}
        keyboardType='default'
        error={this.state.fullnameError}
        />
        <Input 
        placeholder='000-000-0000'
        mask='phone'
        label="Phone"
        name="phone"
        type="phone"
        onChangeText= {(phone) => this.props.UserStore.phone = phone}
        value={this.props.UserStore.phone}
        keyboardType='phone-pad'
        maxLength = {17}
        error={this.state.phoneError}
        />
        <Input 
        placeholder='Enter email...'
        label="Email"
        name="email"
        onChangeText= {(email) => this.props.UserStore.email = email}
        value={this.props.UserStore.email}
        keyboardType='email-address'
        maxLength = {55}
        error={this.state.emailError}
        />
        <Input 
        placeholder='Enter password...'
        label="Password"
        name="password"
        secureTextEntry
        onChangeText = {(password) => this.props.UserStore.password = password}
        value={this.props.UserStore.password}
        maxLength = {55}
        keyboardType='default'
        error={this.state.passwordError}
        />
        <Button style={{backgroundColor: "#FF8708"}} textStyle={{color:"#FFFFFF"}} onPress = {() => this.onPressSignUp("HomeScreen")}>Sign Up</Button>
        <Text onPress={() => this.toggleSignInOrUp()} style={styles.hyperlink}>Or Log In</Text>
      </View>
    )
  }
  
}

  render() {

      return (
        <ScrollView contentContainerStyle={{flexGrow : 1, justifyContent : 'center'}}>
          <KeyboardAvoidingView 
            // style={{backgroundColor: 'purple'}}
            behavior={"padding"} 
            keyboardVerticalOffset={120}
            enabled 
          >
            <View style={styles.primaryView}>
             {!this.state.authenticating ?<Image source={logo} style={styles.img}/> : null}
             {this.renderCurrentState()}
             {/* <View style={{height: 60}}/> */}
             </View>
          </KeyboardAvoidingView>
        </ScrollView>
        
    
      )
    }
}

const styles = StyleSheet.create({
  primaryView:{
    paddingHorizontal: 24,
  },
  img:{
    width: 150,
    resizeMode: 'contain',
    alignSelf: 'center'
  },
  form: {
    flex: 1,
  },
  hyperlink: {
    color: 'blue',
    textDecorationLine: 'underline',
    fontSize: 18,
    alignSelf: 'center',
    marginTop: 24
  }
});