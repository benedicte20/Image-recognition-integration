
const resizeImg = function (img) {
    return new Promise((resolve, reject) => {
      new Compressor(img, {
        quality: 0.6,
        success(result) {
          // Reject if over 50mb (52428800)
          if (result.size > 52428800) reject("Bilden är för stor, max 50mb.");
          else return resolve(result);
        },
        error(e) {
          let errMsg = e.message;
          if (
            errMsg ===
            "The first argument must be an image File or Blob object."
          ) {
            errMsg = "Filformatet stöds tyvärr inte.";
          }
          reject(errMsg);
        },
      });
    });
  }

const uploadClicked = async function () { 
    this.file = this.$refs.file.files[0];
    let reader = new FileReader();
    reader.onload = async () => {
      this.img = reader.result;
    };
    try {
      let img = await this.resizeImg(this.file);
      reader.readAsDataURL(img);
      this.errorMsg = null;
    } catch (e) {
      if (e === "The first argument must be a File or Blob object.") return;
      this.removeFile();
      this.errorMsg = e;
    }
  }

const uploadFile = async function () {
    if (!this.file) return (this.errorMsg = "Du måste välja upp en bild");
    this.errorMsg = null;
    this.loading = true;
    const user = auth().currentUser;
    const fileName = user.uid + "-" + Date.now() + "-" + this.file.name;
    const path = "receipts/" + fileName;
    try {
      let ref = storage.ref().child(path);
      await ref.putString(this.img, "data_url");
      this.validateReceiptImage(fileName);
      // this.loading = false;
    } catch (e) {
      this.$emit("error", e.message);
      this.loading = false;
      ANALYTICS.event("exception", {
        description: e.message,
      });
    }
  }



/**
     * Validates a receipt image by sending a request to the 'RequestManager' function.
     * @param {string} fileName - The name of the receipt image file.
     * When the image is a receipt, display a model to inform the user that image is accepted for 3sec
     * Otherwise, inform the user with displaying an error message
     */
const validateReceiptImage = async function (fileName) {
    try {
      // Call the 'RequestManager' function with the provided 'fileName'
      this.loading = true;
      const { data } = await FUNCTIONS('RequestManager', {
        fileName,
      });
        this.imgIsReceipt = data.isReceipt;
      // Add the receipt reference to a relevant Payout
        FUNCTIONS("addRewardPayoutReceiptRef", {
          fileName: fileName,
          payoutId: this.payoutId,
        });
        this.loading = false;
        setTimeout(()=>{ this.$emit("success")}, 3000);
        
    } catch (error) {
      this.loading = false;
      this.errorMsg = error.message;
      this.removeFile();
    }
  }

 
