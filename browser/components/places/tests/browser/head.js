/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */


XPCOMUtils.defineLazyModuleGetter(this, "NetUtil",
  "resource://gre/modules/NetUtil.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "Promise",
  "resource://gre/modules/Promise.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "PlacesTestUtils",
  "resource://testing-common/PlacesTestUtils.jsm");

// We need to cache this before test runs...
let cachedLeftPaneFolderIdGetter;
let (getter = PlacesUIUtils.__lookupGetter__("leftPaneFolderId")) {
  if (!cachedLeftPaneFolderIdGetter && typeof(getter) == "function")
    cachedLeftPaneFolderIdGetter = getter;
}
// ...And restore it when test ends.
registerCleanupFunction(function(){
  let (getter = PlacesUIUtils.__lookupGetter__("leftPaneFolderId")) {
    if (cachedLeftPaneFolderIdGetter && typeof(getter) != "function")
      PlacesUIUtils.__defineGetter__("leftPaneFolderId",
                                     cachedLeftPaneFolderIdGetter);
  }
});

function openLibrary(callback, aLeftPaneRoot) {
  let library = window.openDialog("chrome://browser/content/places/places.xul",
                                  "", "chrome,toolbar=yes,dialog=no,resizable",
                                  aLeftPaneRoot);
  waitForFocus(function () {
    callback(library);
  }, library);

  return library;
}

/**
 * Returns a handle to a Library window.
 * If one is opens returns itm otherwise it opens a new one.
 *
 * @param aLeftPaneRoot
 *        Hierarchy to open and select in the left pane.
 */
function promiseLibrary(aLeftPaneRoot) {
  let deferred = Promise.defer();
  let library = Services.wm.getMostRecentWindow("Places:Organizer");
  if (library && !library.closed) {
    if (aLeftPaneRoot)
      library.PlacesOrganizer.selectLeftPaneContainerByHierarchy(aLeftPaneRoot);
    deferred.resolve(library);
  }
  else {
    openLibrary(aLibrary => deferred.resolve(aLibrary), aLeftPaneRoot);
  }
  return deferred.promise;
}

/**
 * Waits for a clipboard operation to complete, looking for the expected type.
 *
 * @see waitForClipboard
 *
 * @param aPopulateClipboardFn
 *        Function to populate the clipboard.
 * @param aFlavor
 *        Data flavor to expect.
 */
function promiseClipboard(aPopulateClipboardFn, aFlavor) {
  let deferred = Promise.defer();
  waitForClipboard(function (aData) !!aData,
                   aPopulateClipboardFn,
                   function () { deferred.resolve(); },
                   aFlavor);
  return deferred.promise;
}

/**
 * Waits for all pending async statements on the default connection, before
 * proceeding with aCallback.
 *
 * @param aCallback
 *        Function to be called when done.
 * @param aScope
 *        Scope for the callback.
 * @param aArguments
 *        Arguments array for the callback.
 *
 * @note The result is achieved by asynchronously executing a query requiring
 *       a write lock.  Since all statements on the same connection are
 *       serialized, the end of this write operation means that all writes are
 *       complete.  Note that WAL makes so that writers don't block readers, but
 *       this is a problem only across different connections.
 */
function waitForAsyncUpdates(aCallback, aScope, aArguments)
{
  let scope = aScope || this;
  let args = aArguments || [];
  let db = PlacesUtils.history.QueryInterface(Ci.nsPIPlacesDatabase)
                              .DBConnection;
  let begin = db.createAsyncStatement("BEGIN EXCLUSIVE");
  begin.executeAsync();
  begin.finalize();

  let commit = db.createAsyncStatement("COMMIT");
  commit.executeAsync({
    handleResult: function() {},
    handleError: function() {},
    handleCompletion: function(aReason)
    {
      aCallback.apply(scope, args);
    }
  });
  commit.finalize();
}

/**
 * Asynchronously adds visits to a page, invoking a callback function when done.
 *
 * @param aPlaceInfo
 *        Can be an nsIURI, in such a case a single LINK visit will be added.
 *        Otherwise can be an object describing the visit to add, or an array
 *        of these objects:
 *          { uri: nsIURI of the page,
 *            transition: one of the TRANSITION_* from nsINavHistoryService,
 *            [optional] title: title of the page,
 *            [optional] visitDate: visit date in microseconds from the epoch
 *            [optional] referrer: nsIURI of the referrer for this visit
 *          }
 * @param [optional] aCallback
 *        Function to be invoked on completion.
 * @param [optional] aStack
 *        The stack frame used to report errors.
 */
function addVisits(aPlaceInfo, aWindow, aCallback, aStack) {
  let stack = aStack || Components.stack.caller;
  let places = [];
  if (aPlaceInfo instanceof Ci.nsIURI) {
    places.push({ uri: aPlaceInfo });
  }
  else if (Array.isArray(aPlaceInfo)) {
    places = places.concat(aPlaceInfo);
  } else {
    places.push(aPlaceInfo)
  }

  // Create mozIVisitInfo for each entry.
  let now = Date.now();
  for (let i = 0; i < places.length; i++) {
    if (!places[i].title) {
      places[i].title = "test visit for " + places[i].uri.spec;
    }
    places[i].visits = [{
      transitionType: places[i].transition === undefined ? PlacesUtils.history.TRANSITION_LINK
                                                         : places[i].transition,
      visitDate: places[i].visitDate || (now++) * 1000,
      referrerURI: places[i].referrer
    }];
  }

  aWindow.PlacesUtils.asyncHistory.updatePlaces(
    places,
    {
      handleError: function AAV_handleError() {
        throw("Unexpected error in adding visit.");
      },
      handleResult: function () {},
      handleCompletion: function UP_handleCompletion() {
        if (aCallback)
          aCallback();
      }
    }
  );
}

function synthesizeClickOnSelectedTreeCell(aTree, aOptions) {
  let tbo = aTree.treeBoxObject;
  if (tbo.view.selection.count != 1)
     throw new Error("The test node should be successfully selected");
  // Get selection rowID.
  let min = {}, max = {};
  tbo.view.selection.getRangeAt(0, min, max);
  let rowID = min.value;
  tbo.ensureRowIsVisible(rowID);
  // Calculate the click coordinates.
  var rect = tbo.getCoordsForCellItem(rowID, aTree.columns[0], "text");
  var x = rect.x + rect.width / 2;
  var y = rect.y + rect.height / 2;
  // Simulate the click.
  EventUtils.synthesizeMouse(aTree.body, x, y, aOptions || {},
                             aTree.ownerDocument.defaultView);
}

/**
 * Asynchronously adds visits to a page.
 *
 * @param aPlaceInfo
 *        Can be an nsIURI, in such a case a single LINK visit will be added.
 *        Otherwise can be an object describing the visit to add, or an array
 *        of these objects:
 *          { uri: nsIURI of the page,
 *            transition: one of the TRANSITION_* from nsINavHistoryService,
 *            [optional] title: title of the page,
 *            [optional] visitDate: visit date in microseconds from the epoch
 *            [optional] referrer: nsIURI of the referrer for this visit
 *          }
 *
 * @return {Promise}
 * @resolves When all visits have been added successfully.
 * @rejects JavaScript exception.
 */
function promiseAddVisits(aPlaceInfo)
{
  let deferred = Promise.defer();
  let places = [];
  if (aPlaceInfo instanceof Ci.nsIURI) {
    places.push({ uri: aPlaceInfo });
  }
  else if (Array.isArray(aPlaceInfo)) {
    places = places.concat(aPlaceInfo);
  } else {
    places.push(aPlaceInfo)
  }

  // Create mozIVisitInfo for each entry.
  let now = Date.now();
  for (let i = 0; i < places.length; i++) {
    if (!places[i].title) {
      places[i].title = "test visit for " + places[i].uri.spec;
    }
    places[i].visits = [{
      transitionType: places[i].transition === undefined ? PlacesUtils.history.TRANSITION_LINK
                                                         : places[i].transition,
      visitDate: places[i].visitDate || (now++) * 1000,
      referrerURI: places[i].referrer
    }];
  }

  PlacesUtils.asyncHistory.updatePlaces(
    places,
    {
      handleError: function AAV_handleError(aResultCode, aPlaceInfo) {
        let ex = new Components.Exception("Unexpected error in adding visits.",
                                          aResultCode);
        deferred.reject(ex);
      },
      handleResult: function () {},
      handleCompletion: function UP_handleCompletion() {
        deferred.resolve();
      }
    }
  );

  return deferred.promise;
}

/**
 * Asynchronously check a url is visited.
 *
 * @param aURI The URI.
 * @return {Promise}
 * @resolves When the check has been added successfully.
 * @rejects JavaScript exception.
 */
function promiseIsURIVisited(aURI) {
  let deferred = Promise.defer();

  PlacesUtils.asyncHistory.isURIVisited(aURI, function(aURI, aIsVisited) {
    deferred.resolve(aIsVisited);
  });

  return deferred.promise;
}

/**
 * Waits for all pending async statements on the default connection.
 *
 * @return {Promise}
 * @resolves When all pending async statements finished.
 * @rejects Never.
 *
 * @note The result is achieved by asynchronously executing a query requiring
 *       a write lock.  Since all statements on the same connection are
 *       serialized, the end of this write operation means that all writes are
 *       complete.  Note that WAL makes so that writers don't block readers, but
 *       this is a problem only across different connections.
 */
function promiseAsyncUpdates()
{
  let deferred = Promise.defer();

  let db = DBConn();
  let begin = db.createAsyncStatement("BEGIN EXCLUSIVE");
  begin.executeAsync();
  begin.finalize();

  let commit = db.createAsyncStatement("COMMIT");
  commit.executeAsync({
    handleResult: function () {},
    handleError: function () {},
    handleCompletion: function(aReason)
    {
      deferred.resolve();
    }
  });
  commit.finalize();

  return deferred.promise;
}

function promiseBookmarksNotification(notification, conditionFn) {
  info(`Waiting for ${notification}`);
  return new Promise((resolve, reject) => {
    let proxifiedObserver = new Proxy({}, {
      get: (target, name) => {
        if (name == "QueryInterface")
          return XPCOMUtils.generateQI([ Ci.nsINavBookmarkObserver ]);
        if (name == notification)
          return () => {
            if (conditionFn.apply(this, arguments)) {
              clearTimeout(timeout);
              PlacesUtils.bookmarks.removeObserver(proxifiedObserver, false);
              executeSoon(resolve);
            }
          }
        return () => {};
      }
    });
    PlacesUtils.bookmarks.addObserver(proxifiedObserver, false);
    let timeout = setTimeout(() => {
      PlacesUtils.bookmarks.removeObserver(proxifiedObserver, false);
      reject(new Error("Timed out while waiting for bookmarks notification"));
    }, 2000);
  });
}

function promiseHistoryNotification(notification, conditionFn) {
  info(`Waiting for ${notification}`);
  return new Promise((resolve, reject) => {
    let proxifiedObserver = new Proxy({}, {
      get: (target, name) => {
        if (name == "QueryInterface")
          return XPCOMUtils.generateQI([ Ci.nsINavHistoryObserver ]);
        if (name == notification)
          return () => {
            if (conditionFn.apply(this, arguments)) {
              clearTimeout(timeout);
              PlacesUtils.history.removeObserver(proxifiedObserver, false);
              executeSoon(resolve);
            }
          }
        return () => {};
      }
    });
    PlacesUtils.history.addObserver(proxifiedObserver, false);
    let timeout = setTimeout(() => {
      PlacesUtils.history.removeObserver(proxifiedObserver, false);
      reject(new Error("Timed out while waiting for history notification"));
    }, 2000);
  });
}

/**
 * Makes the specified toolbar visible or invisible and returns a Promise object
 * that is resolved when the toolbar has completed any animations associated
 * with hiding or showing the toolbar.
 *
 * Note that this code assumes that changes to a toolbar's visibility trigger
 * a transition on the max-height property of the toolbar element.
 * Changes to this styling could cause the returned Promise object to be
 * resolved too early or not at all.
 *
 * @param aToolbar
 *        The toolbar to update.
 * @param aVisible
 *        True to make the toolbar visible, false to make it hidden.
 *
 * @return {Promise}
 * @resolves Any animation associated with updating the toolbar's visibility has
 *           finished.
 * @rejects Never.
 */
function promiseSetToolbarVisibility(aToolbar, aVisible, aCallback) {
  return new Promise((resolve, reject) => {
    function listener(event) {
      if (event.propertyName == "max-height") {
        aToolbar.removeEventListener("transitionend", listener);
        resolve();
      }
    }

    let transitionProperties =
      window.getComputedStyle(aToolbar).transitionProperty.split(", ");
    if (isToolbarVisible(aToolbar) != aVisible &&
        (transitionProperties.includes("max-height") ||
         transitionProperties.includes("all"))) {
      // Just because max-height is a transitionable property doesn't mean
      // a transition will be triggered, but it's more likely.
      aToolbar.addEventListener("transitionend", listener);
      setToolbarVisibility(aToolbar, aVisible);
      return;
    }

    // No animation to wait for
    setToolbarVisibility(aToolbar, aVisible);
    resolve();
  });
}

/**
 * Helper function to determine if the given toolbar is in the visible
 * state according to its autohide/collapsed attribute.
 *
 * @aToolbar The toolbar to query.
 *
 * @returns True if the relevant attribute on |aToolbar| indicates it is
 *          visible, false otherwise.
 */
function isToolbarVisible(aToolbar) {
  let hidingAttribute = aToolbar.getAttribute("type") == "menubar"
                        ? "autohide"
                        : "collapsed";
  let hidingValue = aToolbar.getAttribute(hidingAttribute).toLowerCase();
  // Check for both collapsed="true" and collapsed="collapsed"
  return hidingValue !== "true" && hidingValue !== hidingAttribute;
}
