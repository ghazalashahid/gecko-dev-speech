/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef mozilla_dom_telephony_TelephonyChild_h
#define mozilla_dom_telephony_TelephonyChild_h

#include "mozilla/dom/telephony/PTelephonyChild.h"
#include "mozilla/dom/telephony/PTelephonyRequestChild.h"
#include "mozilla/dom/telephony/TelephonyCommon.h"
#include "nsITelephonyCallInfo.h"
#include "nsITelephonyService.h"

BEGIN_TELEPHONY_NAMESPACE

class TelephonyIPCService;

class TelephonyChild : public PTelephonyChild
{
public:
  explicit TelephonyChild(TelephonyIPCService* aService);

protected:
  virtual ~TelephonyChild();

  virtual void
  ActorDestroy(ActorDestroyReason aWhy) MOZ_OVERRIDE;

  virtual PTelephonyRequestChild*
  AllocPTelephonyRequestChild(const IPCTelephonyRequest& aRequest) MOZ_OVERRIDE;

  virtual bool
  DeallocPTelephonyRequestChild(PTelephonyRequestChild* aActor) MOZ_OVERRIDE;

  virtual bool
  RecvNotifyCallError(const uint32_t& aClientId, const int32_t& aCallIndex,
                      const nsString& aError) MOZ_OVERRIDE;

  virtual bool
  RecvNotifyCallStateChanged(nsITelephonyCallInfo* const& aInfo) MOZ_OVERRIDE;

  virtual bool
  RecvNotifyCdmaCallWaiting(const uint32_t& aClientId,
                            const IPCCdmaWaitingCallData& aData) MOZ_OVERRIDE;

  virtual bool
  RecvNotifyConferenceCallStateChanged(const uint16_t& aCallState) MOZ_OVERRIDE;

  virtual bool
  RecvNotifyConferenceError(const nsString& aName,
                            const nsString& aMessage) MOZ_OVERRIDE;

  virtual bool
  RecvNotifySupplementaryService(const uint32_t& aClientId,
                                 const int32_t& aCallIndex,
                                 const uint16_t& aNotification) MOZ_OVERRIDE;

private:
  nsRefPtr<TelephonyIPCService> mService;
};

class TelephonyRequestChild : public PTelephonyRequestChild
{
public:
  TelephonyRequestChild(nsITelephonyListener* aListener,
                        nsITelephonyCallback* aCallback);

protected:
  virtual ~TelephonyRequestChild() {}

  virtual void
  ActorDestroy(ActorDestroyReason aWhy) MOZ_OVERRIDE;

  virtual bool
  Recv__delete__(const IPCTelephonyResponse& aResponse) MOZ_OVERRIDE;

  virtual bool
  RecvNotifyEnumerateCallState(nsITelephonyCallInfo* const& aInfo) MOZ_OVERRIDE;

  virtual bool
  RecvNotifyDialMMI(const nsString& aServiceCode) MOZ_OVERRIDE;

private:
  bool
  DoResponse(const SuccessResponse& aResponse);

  bool
  DoResponse(const ErrorResponse& aResponse);

  bool
  DoResponse(const DialResponseCallSuccess& aResponse);

  bool
  DoResponse(const DialResponseMMISuccess& aResponse);

  bool
  DoResponse(const DialResponseMMIError& aResponse);

  nsCOMPtr<nsITelephonyListener> mListener;
  nsCOMPtr<nsITelephonyCallback> mCallback;
};

END_TELEPHONY_NAMESPACE

#endif // mozilla_dom_telephony_TelephonyChild_h
