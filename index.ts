import * as aws from '@pulumi/aws';
import * as pulumi from '@pulumi/pulumi';

// Define the VPC and Subnet (use default VPC and subnets for simplicity)
const defaultVpc = aws.ec2.getVpc({ default: true });
const defaultSubnets = aws.ec2.getSubnets({
  filters: [{ name: 'default-for-az', values: ['true'] }],
});

// Security Group to allow inbound traffic
const securityGroup = new aws.ec2.SecurityGroup('satisfactory-sg', {
  description: 'Allow port 7777 TCP and UDP',
  vpcId: defaultVpc.then((vpc) => vpc.id),
  ingress: [
    {
      protocol: 'tcp',
      fromPort: 7777,
      toPort: 7777,
      cidrBlocks: ['0.0.0.0/0'],
    },
    {
      protocol: 'udp',
      fromPort: 7777,
      toPort: 7777,
      cidrBlocks: ['0.0.0.0/0'],
    },
  ],
  egress: [
    {
      protocol: '-1', // Allow all outbound traffic
      fromPort: 0,
      toPort: 0,
      cidrBlocks: ['0.0.0.0/0'],
    },
  ],
});

// IAM Role and Instance Profile for the ECS Instance
const ecsInstanceRole = new aws.iam.Role('ecsInstanceRole', {
  assumeRolePolicy: JSON.stringify({
    Version: '2008-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Principal: { Service: 'ec2.amazonaws.com' },
        Action: 'sts:AssumeRole',
      },
    ],
  }),
});

new aws.iam.RolePolicyAttachment('ecsInstanceRoleAttachment', {
  role: ecsInstanceRole.name,
  policyArn: aws.iam.ManagedPolicies.AmazonEC2ContainerServiceforEC2Role,
});

const ecsInstanceProfile = new aws.iam.InstanceProfile('ecsInstanceProfile', {
  role: ecsInstanceRole.name,
});

// Create the ECS Cluster
const ecsCluster = new aws.ecs.Cluster('satisfactory-cluster');

// Get the ECS-optimized Amazon Linux 2 AMI
const ecsAmiId = aws.ssm
  .getParameter({
    name: '/aws/service/ecs/optimized-ami/amazon-linux-2/recommended/image_id',
  })
  .then((param) => param.value);

// Create the EBS Volume that will persist
const ebsVolume = new aws.ebs.Volume('satisfactory-ebs-volume', {
  availabilityZone: 'ap-southeast-2b',
  size: 100, // Size in GB
  type: 'gp3', // High-performance volume type
  tags: {
    Name: 'SatisfactoryData',
  },
});

// Create the EC2 instance to join the ECS Cluster
const ec2Instance = new aws.ec2.Instance('satisfactory-instance', {
  ami: ecsAmiId,
  instanceType: 'm5.xlarge',
  availabilityZone: 'ap-southeast-2b',
  subnetId: defaultSubnets.then((subnets) => subnets.ids[0]),
  vpcSecurityGroupIds: [securityGroup.id],
  iamInstanceProfile: ecsInstanceProfile.name,
  // keyName: 'your-key-name', // Replace with your AWS key pair name
  // IT FAILED HERE THIS TIME
  // the cluster never found this instance
  // so the task was never able to launch
  userData: pulumi.interpolate`#!/bin/bash
echo ECS_CLUSTER=${ecsCluster.name} >> /etc/ecs/ecs.config

# Install jq for JSON parsing
yum install -y jq

# Attach the EBS volume
instance_id=$(curl http://169.254.169.254/latest/meta-data/instance-id)
aws ec2 attach-volume --volume-id ${ebsVolume.id} --instance-id $instance_id --device /dev/sdf --region ${aws.config.region}

# Wait for the volume to be attached
while [ ! -e /dev/xvdf ]; do sleep 1; done

# Format and mount the volume if not already formatted
if ! file -s /dev/xvdf | grep ext4; then
    mkfs -t ext4 /dev/xvdf
fi
mkdir -p /mnt/config
mount /dev/xvdf /mnt/config
echo "/dev/xvdf /mnt/config ext4 defaults,nofail 0 2" >> /etc/fstab
`,
  rootBlockDevice: {
    volumeSize: 30, // Increase root volume size if needed
  },
  // Ensure the root volume is also retained if needed
  // rootBlockDevice: {
  //     volumeSize: 30,
  //     deleteOnTermination: false,
  // },
  // We no longer need to specify ebsBlockDevices here since we're creating and attaching the EBS volume separately
  tags: {
    Name: 'SatisfactoryInstance',
  },
});

// Allocate an Elastic IP and associate it with the instance
const elasticIp = new aws.ec2.Eip('satisfactory-eip', {
  instance: ec2Instance.id,
});

// IAM Role for ECS Task Execution
const ecsTaskRole = new aws.iam.Role('ecsTaskExecutionRole', {
  assumeRolePolicy: JSON.stringify({
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Principal: { Service: 'ecs-tasks.amazonaws.com' },
        Action: 'sts:AssumeRole',
      },
    ],
  }),
});

// Attach the necessary policies to the task execution role
new aws.iam.RolePolicyAttachment('ecsTaskExecutionRolePolicy', {
  role: ecsTaskRole.name,
  policyArn: 'arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy',
});

const GROUPNAME = 'satisfactorylogs';
// CloudWatch Log Group for the task
const logGroup = new aws.cloudwatch.LogGroup(GROUPNAME, { name: GROUPNAME, retentionInDays: 7 });

// ECS Task Definition
const taskDefinition = new aws.ecs.TaskDefinition('satisfactory-task', {
  family: 'satisfactory-server',
  networkMode: 'bridge',
  requiresCompatibilities: ['EC2'],
  cpu: '2048', // 2 vCPU
  memory: '16384', // 16 GB
  executionRoleArn: ecsTaskRole.arn,
  containerDefinitions: JSON.stringify([
    {
      name: 'satisfactory-server',
      image: 'wolveix/satisfactory-server:latest',
      essential: true,
      portMappings: [
        {
          containerPort: 7777,
          hostPort: 7777,
          protocol: 'tcp',
        },
        {
          containerPort: 7777,
          hostPort: 7777,
          protocol: 'udp',
        },
      ],
      mountPoints: [
        {
          sourceVolume: 'config-volume',
          containerPath: '/config',
          readOnly: false,
        },
      ],
      logConfiguration: {
        logDriver: 'awslogs',
        options: {
          'awslogs-group': GROUPNAME,
          'awslogs-region': aws.config.region,
          'awslogs-stream-prefix': 'satisfactory-server',
        },
      },
    },
  ]),
  volumes: [
    {
      name: 'config-volume',
      hostPath: '/mnt/config', // Host path on the EC2 instance
    },
  ],
});

// ECS Service
const ecsService = new aws.ecs.Service('satisfactory-service', {
  cluster: ecsCluster.arn,
  desiredCount: 1, // Run one task
  launchType: 'EC2',
  taskDefinition: taskDefinition.arn,
  waitForSteadyState: true,
});

// Ensure the EBS volume is not deleted when the instance is terminated
const volumeAttachment = new aws.ec2.VolumeAttachment(
  'ebsAttachment',
  {
    deviceName: '/dev/sdf',
    instanceId: ec2Instance.id,
    volumeId: ebsVolume.id,
    skipDestroy: true, // Prevents Pulumi from detaching the volume on destroy
  },
  { dependsOn: [ec2Instance] }
);

// Export the public IP address of the instance
export const { publicIp } = elasticIp;
