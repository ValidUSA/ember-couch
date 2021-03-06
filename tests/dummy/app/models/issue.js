import DS from "ember-data";

export default DS.Model.extend({
    text: DS.attr("string"),
    type: DS.attr("string", {
        defaultValue: "issue"
    }),
    attachments: DS.hasMany("attachment", {
        async: true
    }),
    rev: DS.attr("string")
});
