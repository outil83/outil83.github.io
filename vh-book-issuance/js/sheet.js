
//var CONST_GSHEET_BASE_URL = 'https://sheets.googleapis.com/v4/spreadsheets/';
var CONST_GSHEET_BASE_URL = 'https://content-sheets.googleapis.com/v4/spreadsheets/';
var CONST_GSHEET_GET_VALUES = CONST_GSHEET_BASE_URL + "{sheetId}/values/{valueRange}?key={apiKey}";

(function($) {
    "use strict"; // Start of use strict

    function ValueRange(range, majorDimension, values) {
        this.range = range;
        this.majorDimension = majorDimension;
        this.values = values;
    }

    $.extend(ValueRange.prototype, {
        getRange : function () {
            return this.range;
        },
        getMajorDimension : function () {
            return this.majorDimension;
        },
        getValues : function () {
            return this.values;
        }
    });

    ValueRange.fromJson = function (json) {
        var jsonObj = JSON.parse(json);
        return new ValueRange(jsonObj.range, jsonObj.majorDimension, jsonObj.values);
    };

    function MultiValueRange(spreadsheetId, valueRanges) {
        this.spreadsheetId = spreadsheetId;
        this.valueRanges = valueRanges;
    }

    $.extend(MultiValueRange.prototype, {
        getSpreadsheetId : function () {
            return this.spreadsheetId;
        },
        getValueRanges : function () {
            return this.valueRanges;
        }
    });

    function Sheet(options) {
        this.sheetId = options.sheetId;
        this.apiKey = options.apiKey;
    }

    $.extend(Sheet.prototype, {
        getSheetId : function () {
            return this.sheetId;
        },
        getApiKey : function () {
            return this.apiKey;
        },
        getValues : function (sheetName, range) {
            var url = CONST_GSHEET_GET_VALUES.replace('{sheetId}', this.getSheetId()).replace('{valueRange}', sheetName + '!' + range).replace('{apiKey}', this.getApiKey()),
                result = new ValueRange();
            $.ajax({
                async: false,
                type: 'GET',
                url: url,
                contentType: 'application/json charset=utf-8',
                crossDomain: true,
                converters : {
                    'text ValueRange' : function (textresponse) {
                        return ValueRange.fromJson(textresponse);
                    }
                },
                success: function (response) {
                    result = response;
                },
                dataType: 'ValueRange'
            });
            return result;
        }
    });
    
    $.Sheet = Sheet;
    $.ValueRange = ValueRange;
    $.MultiValueRange = MultiValueRange;
    
})(jQuery);
