import { Redirect } from "expo-router";
export default function Index(){
    console.log('📍 Index - Redirecting to Onboarding');
    return <Redirect href="/Welcome" />
}