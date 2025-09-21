import React from 'react';
import { useSignOut } from 'react-firebase-hooks/auth';
import { auth } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { Icon } from '../ui/Icon';
import { userProfileStyles, getInfoIconClasses, getInfoValueClasses } from './UserProfile.styles';

export const UserProfile = () => {
  const { user } = useAuth();
  const [signOut, loading, error] = useSignOut(auth);

  if (!user) {
    return null;
  }

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <div className={userProfileStyles.container}>
      <Card className={userProfileStyles.card}>
        <CardHeader className={userProfileStyles.header}>
          <div className={userProfileStyles.headerContent}>
            <CardTitle className={userProfileStyles.title}>User Profile</CardTitle>
            <div className={userProfileStyles.avatar}>
              <span className={userProfileStyles.avatarText}>
                {user.email?.charAt(0).toUpperCase()}
              </span>
            </div>
          </div>
        </CardHeader>

        <CardContent className={userProfileStyles.content}>
          <div className={userProfileStyles.infoSection}>
            <div className={userProfileStyles.infoItem}>
              <div className={userProfileStyles.infoIconEmail}>
                <Icon size={16} className="text-blue-600">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207"></path>
                </Icon>
              </div>
              <div>
                <p className={userProfileStyles.infoLabel}>Email</p>
                <p className={getInfoValueClasses("default")}>{user.email}</p>
              </div>
            </div>
            
            <div className={userProfileStyles.infoItem}>
              <div className={userProfileStyles.infoIconUser}>
                <Icon size={16} className="text-purple-600">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V4a2 2 0 114 0v2m-4 0a2 2 0 104 0m-4 0H9m4 0V4a2 2 0 114 0v2"></path>
                </Icon>
              </div>
              <div>
                <p className={userProfileStyles.infoLabel}>User ID</p>
                <p className={getInfoValueClasses("mono")}>{user.uid.substring(0, 20)}...</p>
              </div>
            </div>
            
            <div className={userProfileStyles.infoItem}>
              <div className={getInfoIconClasses(user.emailVerified)}>
                {user.emailVerified ? (
                  <Icon size={16} className="text-green-600" style={{fill: 'currentColor'}}>
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path>
                  </Icon>
                ) : (
                  <Icon size={16} className="text-red-600" style={{fill: 'currentColor'}}>
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"></path>
                  </Icon>
                )}
              </div>
              <div>
                <p className={userProfileStyles.infoLabel}>Email Status</p>
                <p className={getInfoValueClasses(user.emailVerified ? "verified" : "unverified")}>
                  {user.emailVerified ? 'Verified' : 'Not Verified'}
                </p>
              </div>
            </div>
          </div>

          {error && (
            <div className={userProfileStyles.errorContainer}>
              <Icon size={20} className={userProfileStyles.errorIcon} style={{fill: 'currentColor'}}>
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"></path>
              </Icon>
              <div>
                <p className={userProfileStyles.errorTitle}>Sign Out Error</p>
                <p className={userProfileStyles.errorMessage}>{error.message}</p>
              </div>
            </div>
          )}

          <Button
            onClick={handleSignOut}
            disabled={loading}
            variant="destructive"
            className={userProfileStyles.signOutButton}
          >
            {loading ? (
              <div className={userProfileStyles.loadingContainer}>
                <Icon size={20} className={userProfileStyles.loadingIcon}>
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </Icon>
                Signing Out...
              </div>
            ) : (
              <div className={userProfileStyles.buttonContent}>
                <Icon size={20} className={userProfileStyles.buttonIcon}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path>
                </Icon>
                Sign Out
              </div>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};