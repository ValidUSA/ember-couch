/* global App */
import Ember from "ember";

export default Ember.Controller.extend({
    model: Ember.computed.alias("position.issues"),
    actions: {
        createIssue: function (text) {
            var self = this,
                issue = this.get("store").createRecord("issue", {
                    text: text
                });
            issue.save().then(function (issue) {
                if (self.get("position.issues.isLoaded")) {
                    self.get("position.issues").pushObject(issue);
                    self.get("position").save();
                } else {
                    self.get("position.issues").then(function (issues) {
                        self.get("position.issues").pushObject(issue);
                        self.get("position").save();
                    });
                }
            });
        },

        saveIssue: function (model) {
            model.save();
        },

        deleteIssue: function (issue) {
            var self = this;
            self.get("position.issues").removeObject(issue);
            issue.deleteRecord();
            issue.save().then(function () {
                self.get("position").save();
            });
        },

        addAttachment: function (files, model) {
            this._actions._addAttachment(0, files, files.length, model, this);
        },

        _addAttachment: function (count, files, size, model, self) {
            var file = files[count],
                attachmentId = model.id + "/" + file.name,
                params = {
                    doc_id: model.id,
                    model_name: model._internalModel.modelName,
                    rev: model._internalModel._data.rev,
                    id: attachmentId,
                    file: file,
                    content_type: file.type,
                    length: file.size,
                    file_name: file.name
                },
                attachment = self.get("store").createRecord("attachment", params);

            attachment.save().then(function () {
                model.get("attachments").pushObject(attachment);
                model.reload();
                count = count + 1;
                if (count < size) {
                    self._actions._addAttachment(count, files, size, model, self);
                }
            });
        },

        deleteAttachment: function (attachment, issue) {
            attachment.deleteRecord();
            attachment.save().then(function () {
                issue.save();
            });
        },

        dropIssue: function (compController, compModel, thisModel) {
            var position = this.get("model").toArray().indexOf(thisModel),
                self = this;
            if (position === -1) {
                position = 0;
            }
            compController.get("model").removeObject(compModel);

            if (compController.name !== this.name) {
                compController.get("position").save();
            }

            this.get("model").insertAt(position, compModel);
            this.get("position").save();
        }
    }
});
