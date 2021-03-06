const Lang = imports.lang;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;

const Me = imports.misc.extensionUtils.getCurrentExtension();


/**
 * Custom Entry widget that allows entering a *raw fact* string for a new ongoing fact.
 *
 * Besides general layout this widget is also in charge of providing autocomplete functionality.
 * @class
 *
 *
 */
const OngoingFactEntry = new Lang.Class({
    Name: 'OngoingFactEntry',
    Extends: St.Entry,

    _init: function(controller) {
        this.parent({
            name: 'searchEntry',
            can_focus: true,
            track_hover: true,
            hint_text: _("Enter activity...")
        });

        this._controller = controller
        this._prevText = ''
        // Seems to be populate by GetActivities.
        this._autocompleteActivities = [];
        this._runningActivitiesQuery = null;
        this.clutter_text.connect('activate', Lang.bind(this, this._onEntryActivated));
        this.clutter_text.connect('key-release-event', Lang.bind(this, this._onKeyReleaseEvent));
    },

    /**
     * Callback for when ``ongoingFactEntry`` gets activated.
     *
     * Passes the current widget text as 'raw fact' to the dbus interface in order
     * to create a new 'ongoing fact'.
     * Also resets the text to an empty string afterwards.
     *
     * @callback FactsBox~_onEntryActivated
     */
    _onEntryActivated: function() {
        let text = this.get_text();
        this._controller.apiProxy.AddFactRemote(text, 0, 0, false, Lang.bind(this, function(response, error) {
            // not interested in the new id - this shuts up the warning
        }));
        this.set_text('');
    },

    /**
     * Callback triggered after key release.
     *
     * This is where autocompletion happens.
     *
     * @callback FactsBox~_onKeyReleaseEvent
     */
    _onKeyReleaseEvent: function(textItem, evt) {
        /**
         * Check if the passed key is on our list of keys to be ignored.
         */
        function checkIfIgnoredKey(key) {
            let ignoreKeys = [Clutter.BackSpace, Clutter.Delete, Clutter.Escape];
            // Looks like there is realy no ``Array.includes()`` available as
            // of now.
            let result = ignoreKeys.indexOf(key);
            if (result == -1) {
                result = false;
            } else{
                result = true;
            };
            return result;
        };

        let symbol = evt.get_key_symbol();
        // [FIXME]
        // To limit the scope of the PR we did not refactor this bit too much.
        // We should however take another look at the Instance attributes and
        // see what is really needed and if their naming is apropriate.
        let text = this.get_text().toLowerCase();
        let starttime = "";
        let activitytext = text;

        // [FIXME]
        // Should be a separate function.
        //
        // Don't include leading times in the activity autocomplete
        // [FIXME] Even if the parsing is not flawed (which it most likly is,
        // the variable names are certainly off.
        // [FIXME]
        // If we allow the whole host of raw fact parsing we need to extend our
        // regex.
        let match = [];
        if ((match = text.match(/^\d\d:\d\d /)) ||
            (match = text.match(/^-\d+ /))) {
            starttime = text.substring(0, match[0].length);
            activitytext = text.substring(match[0].length);
        };

        // [FIXME]
        // Should be a separate local function.
        //
        // If nothing has changed or we still have selection then that means
        // that special keys are at play and we don't attempt to autocomplete
        if (activitytext == "" ||
            this._prevText == text ||
            this.clutter_text.get_selection()) {
            return;
        }
        this._prevText = text;

        if (checkIfIgnoredKey(symbol)) { return };

        // [FIXME]
        // Investigate if we can move this into a dedicated 'autocomplete' function.
        //
        // Autocomplete
        // If a key release has been detected: itterate over all activities fetched from the backend
        // (via GetActivities aka __get_activities. This is a list of
        // (activity.name, activivty.category.name) tuples.
        // for each item: If it has a category, construct new composite string 'name@category',
        // else just use 'name'.
        //
        // For each activity we now do the following:
        // - Check if the current iteration item string has the current
        //   entry text as a substring starting from 0 (remember that the iteration item may be
        //  'activity@category'.
        //
        // - If so: We got a hit (if there are multiple, only the first item that triggers the match
        //   will be considered. Further filtering happens due to continued typing, there is no selection
        //   or visual feedback that there was more than one hit.
        // - Now we build a new 'result string' like this 'starttime iterationitem'. starttime is
        //   an empty string at the beginning.
        // - Set the iteration item as new entry text
        // - Select the bit after actually typed text to the end of iteration item. This should
        //   result in removal of the "unmatched bits" once user continues typing
        // - Store a normalized (lower) version of the iteration item (and now new text) in a local
        //  tmo variable. This is used to check against the entry text after new button releases
        //  to see if things have changed.
        //
        //  If not, do nothing.
        for (let activity of this._controller.activities) {
            let name = activity[0];
            let category = activity[1];
            let activityString = name;
            if (category.length > 0) {
                activityString = name + "@" + category;
            }
            // We got a hit.
            if (activityString.toLowerCase().substring(0, activitytext.length) == activitytext) {
                let completion = starttime + activityString;
                this.set_text(completion);
                this.get_clutter_text().set_selection(text.length, completion.length);

                this._prevText = completion.toLowerCase();
            };
        };
    },
});
