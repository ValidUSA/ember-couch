/* global App */
import DocumentAdapter from "ember-couch/adapters/document";

export default DocumentAdapter.extend({
    db: "boards",
    host: App.Host
});