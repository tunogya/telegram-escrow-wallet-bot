# wizardingpay-telegram-bot

```text
                                                                                
   #     #                                               ######                 
   #  #  # # ######   ##   #####  #####  # #    #  ####  #     #   ##   #   #   
   #  #  # #     #   #  #  #    # #    # # ##   # #    # #     #  #  #   # #    
   #  #  # #    #   #    # #    # #    # # # #  # #      ######  #    #   #     
   #  #  # #   #    ###### #####  #    # # #  # # #  ### #       ######   #     
   #  #  # #  #     #    # #   #  #    # # #   ## #    # #       #    #   #     
    ## ##  # ###### #    # #    # #####  # #    #  ####  #       #    #   #     
                                                                                
```


https://t.me/WizardingPayBot

## Deploy on AWS Lambda

1. Create Lambda function (ZIP node_modules and all necessary files like index.js) and set BOT_TOKEN environment variable
to secret token given by BotFather, adjust memory/timeout if needed
2. Create API Gateway -> Add method POST -> Lambda Function -> Deploy -> Copy invoke url
3. Set invoke URL as webhook